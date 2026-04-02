local logger = require("core/log")
local UIManager = require("ui/uimanager")
local InfoMessage = require("ui/widget/infomessage")
local Network = require("adapters/network")
local ProgressEngine = require("engines/progress_engine")
local _ = require("gettext")

local ProgressSync = {}
ProgressSync.__index = ProgressSync
local LOG_PREFIX = "[Sake] "

function ProgressSync:new(ctx)
    return setmetatable({
        engine = ProgressEngine:new(ctx),
        network = Network:new(),
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

function ProgressSync:syncNewProgressForDevice(opts)
    logger.info(LOG_PREFIX .. "Device-level progress sync started.")
    local ok_sync, result_or_err = self.engine:syncRemoteQueue()
    if not ok_sync then
        self:showError("Progress queue fetch failed: " .. tostring(result_or_err), opts)
        return false, result_or_err
    end

    local result = result_or_err
    if result.total == 0 then
        logger.info(LOG_PREFIX .. "No new remote progress updates.")
        return true, { total = 0, applied = 0, failed = 0, errors = {} }
    end
    logger.info(LOG_PREFIX .. "Remote progress queue size: " .. tostring(result.total))

    -- Safety workaround: applying progress while reader is actively open can crash KOReader.
    -- Only auto-apply when no document is open.
    if result.deferred then
        logger.warn(LOG_PREFIX .. "Deferring remote progress apply because a document is open.")
        if not (opts and opts.silent) then
            UIManager:show(InfoMessage:new{
                text = _("Remote progress is available.\nClose the current book to apply safely."),
                timeout = 5
            })
        end
        return true, result
    end

    for _, err_apply in ipairs(result.errors or {}) do
        self:showError(err_apply, opts)
    end

    logger.info(LOG_PREFIX .. "Device-level progress sync done. Applied: " .. tostring(result.applied) .. " Failed: " .. tostring(result.failed))

    return true, result
end

return ProgressSync
