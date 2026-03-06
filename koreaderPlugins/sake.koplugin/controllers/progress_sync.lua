local logger = require("logger")
local UIManager = require("ui/uimanager")
local InfoMessage = require("ui/widget/infomessage")
local ProgressEngine = require("engines/progress_engine")
local _ = require("gettext")

local ProgressSync = {}
ProgressSync.__index = ProgressSync
local LOG_PREFIX = "[Sake] "

function ProgressSync:new(ctx)
    return setmetatable({
        engine = ProgressEngine:new(ctx),
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

function ProgressSync:syncCurrentBookProgress(opts)
    logger.info(LOG_PREFIX .. "Sync current book progress started.")
    local success, percent_finished_or_err = self.engine:uploadCurrentDocumentProgress()
    if not success then
        if percent_finished_or_err == "No document open" then
            logger.info(LOG_PREFIX .. "No document open. Running remote progress download sync.")
            return self:syncNewProgressForDevice(opts)
        end
        self:showError("Progress upload failed: " .. tostring(percent_finished_or_err), opts)
        return false, percent_finished_or_err
    end

    logger.info(LOG_PREFIX .. "Live percent_finished: " .. tostring(percent_finished_or_err))
    logger.info(LOG_PREFIX .. "Progress upload success.")
    return true
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
