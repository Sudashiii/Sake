local logger = require("core/log")
local ConfirmBox = require("ui/widget/confirmbox")
local UIManager = require("ui/uimanager")
local InfoMessage = require("ui/widget/infomessage")
local Network = require("adapters/network")
local ProgressEngine = require("engines/progress_engine")
local _ = require("gettext")

local ProgressSync = {}
ProgressSync.__index = ProgressSync
local LOG_PREFIX = "[Sake] "

local function copyTable(value)
    local copy = {}
    for key, item in pairs(value or {}) do
        copy[key] = item
    end
    return copy
end

function ProgressSync:new(ctx)
    return setmetatable({
        engine = ProgressEngine:new(ctx),
        network = Network:new(),
        reload_in_progress = false,
        reload_guard_storage_key = nil,
    }, self)
end

function ProgressSync:showError(message, opts)
    logger.warn(LOG_PREFIX .. tostring(message))
    if opts and opts.silent then
        return
    end
    UIManager:show(InfoMessage:new{
        text = _("Error: ") .. tostring(message),
        timeout = 6
    })
end

function ProgressSync:hasOpenDocument()
    return self.engine:hasOpenDocument()
end

function ProgressSync:isReloadInProgress()
    return self.reload_in_progress == true
end

function ProgressSync:showDeferredApplyNotice(opts)
    if opts and opts.silent then
        return
    end

    UIManager:show(InfoMessage:new{
        text = _("Remote progress is available.\nClose the current book to apply safely."),
        timeout = 5
    })
end

function ProgressSync:handleApplyResultFeedback(result, opts)
    for _, err_apply in ipairs(result.errors or {}) do
        self:showError(err_apply, opts)
    end

    logger.info(
        LOG_PREFIX
            .. "Device-level progress sync done. Applied: "
            .. tostring(result.applied)
            .. " Failed: "
            .. tostring(result.failed)
    )

    if result.total > 0 and not (opts and opts.silent_summary) then
        local summary = string.format(
            "Remote progress sync:\nApplied %d of %d (%d failed).",
            result.applied,
            result.total,
            result.failed
        )
        UIManager:show(InfoMessage:new{
            text = _(summary),
            timeout = 5
        })
    end
end

function ProgressSync:shouldSuppressReloadPrompt(result)
    local storage_key = tostring(result.current_book and result.current_book.s3_storage_key or "")
    if storage_key == "" then
        self.reload_guard_storage_key = nil
        return false
    end

    if self.reload_guard_storage_key == storage_key then
        logger.info(LOG_PREFIX .. "Skipping reload prompt due to reload guard for: " .. storage_key)
        return true
    end

    return false
end

function ProgressSync:reloadCurrentBookWithQueuedProgress(result, opts)
    local books = result.books or {}
    local storage_key = tostring(result.current_book and result.current_book.s3_storage_key or "")
    if storage_key == "" then
        return false, "Missing current book storage key for reload"
    end

    local feedback_opts = copyTable(opts)
    feedback_opts.silent = false
    feedback_opts.silent_summary = false

    local apply_result = nil
    local apply_error = nil

    self.reload_guard_storage_key = storage_key
    self.reload_in_progress = true
    logger.info(LOG_PREFIX .. "Reloading current book to apply remote progress: " .. storage_key)

    local ok_reload, reload_err = self.engine:reloadCurrentDocument(
        function()
            local ok_apply, result_or_err = self.engine:applyRemoteBooks(books)
            if not ok_apply then
                apply_error = tostring(result_or_err)
                return
            end

            apply_result = result_or_err
        end,
        function()
            self.reload_in_progress = false

            if apply_error then
                self:showError("Progress apply during reload failed: " .. tostring(apply_error), feedback_opts)
                return
            end

            if apply_result then
                self:handleApplyResultFeedback(apply_result, feedback_opts)
            end
        end
    )

    if not ok_reload then
        self.reload_in_progress = false
        self.reload_guard_storage_key = nil
        self:showError("Could not reload current book: " .. tostring(reload_err), feedback_opts)
        return false, reload_err
    end

    return true
end

function ProgressSync:promptReloadForCurrentBook(result, opts)
    UIManager:show(ConfirmBox:new{
        text = _("Remote progress is available for the current book.\nReload it now to apply the latest position?"),
        ok_text = _("Reload"),
        ok_callback = function()
            self:reloadCurrentBookWithQueuedProgress(result, opts)
        end,
        cancel_callback = function()
            logger.info(LOG_PREFIX .. "User declined automatic reload for current book.")
            if not (opts and opts.silent) then
                UIManager:show(InfoMessage:new{
                    text = _("Remote progress will apply after you close the current book."),
                    timeout = 5
                })
            end
        end,
    })
end

function ProgressSync:uploadPreparedSnapshot(snapshot, opts, is_deferred_resume)
    if is_deferred_resume then
        logger.info(LOG_PREFIX .. "Deferred progress upload resumed.")
    end

    local success, percent_finished_or_err = self.engine:uploadPreparedProgressSnapshot(snapshot)
    if not success then
        if is_deferred_resume then
            logger.warn(LOG_PREFIX .. "Deferred progress upload failed: " .. tostring(percent_finished_or_err))
        end
        self:showError("Progress upload failed: " .. tostring(percent_finished_or_err), opts)
        return false, percent_finished_or_err
    end

    if is_deferred_resume then
        logger.info(LOG_PREFIX .. "Deferred progress upload success.")
    else
        logger.info(LOG_PREFIX .. "Progress upload success.")
    end

    return true, percent_finished_or_err
end

function ProgressSync:syncCurrentBookProgress(opts)
    logger.info(LOG_PREFIX .. "Sync current book progress started.")
    local ok_snapshot, snapshot_or_err = self.engine:prepareCurrentDocumentProgressSnapshot()
    if not ok_snapshot then
        if snapshot_or_err == "No document open" then
            if opts and opts.no_remote_fallback then
                logger.info(LOG_PREFIX .. "No document open. Skipping upload because remote fallback is disabled.")
                return true, { no_document = true }
            end
            logger.info(LOG_PREFIX .. "No document open. Running remote progress download sync.")
            return self:syncNewProgressForDevice(opts)
        end
        self:showError("Progress upload failed: " .. tostring(snapshot_or_err), opts)
        return false, snapshot_or_err
    end

    local snapshot = snapshot_or_err
    logger.info(
        LOG_PREFIX
            .. "Prepared progress snapshot for file: "
            .. tostring(snapshot.filename)
            .. " | percent_finished: "
            .. tostring(snapshot.percent_finished)
    )

    -- Freeze the upload payload before handing control to NetworkMgr because
    -- the current document may no longer be available when the callback resumes.
    local deferred = self.network:willRerunWhenOnline(function()
        self:uploadPreparedSnapshot(snapshot, opts, true)
    end)
    if deferred then
        logger.info(LOG_PREFIX .. "Progress upload deferred waiting for network.")
        return true, {
            deferred = true,
            percent_finished = snapshot.percent_finished,
            uploaded = false,
        }
    end

    local success, percent_finished_or_err = self:uploadPreparedSnapshot(snapshot, opts, false)
    if not success then
        return false, percent_finished_or_err
    end

    logger.info(LOG_PREFIX .. "Live percent_finished: " .. tostring(percent_finished_or_err))
    return true, {
        uploaded = true,
        percent_finished = percent_finished_or_err,
    }
end

function ProgressSync:uploadClosedBookProgress(doc_path, opts)
    logger.info(LOG_PREFIX .. "Close-triggered book progress upload started for: " .. tostring(doc_path))

    local ok_snapshot, snapshot_or_err = self.engine:prepareStoredDocumentProgressSnapshot(doc_path)
    if not ok_snapshot then
        self:showError("Close-triggered progress upload failed: " .. tostring(snapshot_or_err), opts)
        return false, snapshot_or_err
    end

    local snapshot = snapshot_or_err
    logger.info(
        LOG_PREFIX
            .. "Prepared flushed sidecar snapshot for file: "
            .. tostring(snapshot.filename)
            .. " | percent_finished: "
            .. tostring(snapshot.percent_finished)
    )

    local deferred = self.network:willRerunWhenOnline(function()
        self:uploadPreparedSnapshot(snapshot, opts, true)
    end)
    if deferred then
        logger.info(LOG_PREFIX .. "Close-triggered progress upload deferred waiting for network.")
        return true, {
            deferred = true,
            uploaded = false,
            percent_finished = snapshot.percent_finished,
            filename = snapshot.filename,
        }
    end

    local success, percent_finished_or_err = self:uploadPreparedSnapshot(snapshot, opts, false)
    if not success then
        return false, percent_finished_or_err
    end

    return true, {
        uploaded = true,
        percent_finished = percent_finished_or_err,
        filename = snapshot.filename,
    }
end

function ProgressSync:syncNewProgressForDevice(opts)
    logger.info(LOG_PREFIX .. "Device-level progress sync started.")
    local ok_sync, result_or_err = self.engine:syncRemoteQueue()
    if not ok_sync then
        self:showError("Progress queue fetch failed: " .. tostring(result_or_err), opts)
        return false, result_or_err
    end

    local result = result_or_err
    if result.total == 0 then
        self.reload_guard_storage_key = nil
        logger.info(LOG_PREFIX .. "No new remote progress updates.")
        return true, { total = 0, applied = 0, failed = 0, errors = {}, books = {} }
    end
    logger.info(LOG_PREFIX .. "Remote progress queue size: " .. tostring(result.total))

    -- Safety workaround: applying progress while reader is actively open can crash KOReader.
    -- Only auto-apply when no document is open.
    if result.deferred then
        if not result.current_book_queued then
            self.reload_guard_storage_key = nil
        elseif result.can_reload_current and not self:shouldSuppressReloadPrompt(result) then
            logger.info(LOG_PREFIX .. "Prompting to reload current book for remote progress apply.")
            self:promptReloadForCurrentBook(result, opts)
            return true, result
        end

        logger.warn(LOG_PREFIX .. "Deferring remote progress apply because a document is open.")
        self:showDeferredApplyNotice(opts)
        return true, result
    end

    self.reload_guard_storage_key = nil
    self:handleApplyResultFeedback(result, opts)
    return true, result
end

return ProgressSync
