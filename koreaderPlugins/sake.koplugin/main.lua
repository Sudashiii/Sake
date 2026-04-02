local Dispatcher = require("dispatcher")
local ConfirmBox = require("ui/widget/confirmbox")
local InfoMessage = require("ui/widget/infomessage")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("core/log")
local _ = require("gettext")

local Settings = require("core/settings")
local Utils = require("core/utils")
local has_sake_device, SakeDevice = pcall(require, "core/device")
local Menu = require("ui/menu")
local Dialogs = require("ui/dialogs")
local Session = require("api/session")
local DeviceApi = require("api/device")
local BookSync = require("controllers/book_sync")
local LibraryExport = require("controllers/library_export")
local ProgressSync = require("controllers/progress_sync")
local PluginMeta = require("_meta")

local Sake = WidgetContainer:extend{
    name = "sake",
    is_doc_only = false,
}

local function copyTable(value)
    local copy = {}
    for key, item in pairs(value or {}) do
        copy[key] = item
    end
    return copy
end

local function getSakePluginDir()
    local src = debug.getinfo(1, "S").source or ""
    local path = src:sub(1, 1) == "@" and src:sub(2) or src
    return path:match("^(.*)/main%.lua$")
end

local function loadUpdaterModule()
    local sake_dir = getSakePluginDir()
    if not sake_dir then
        return false, "Cannot determine Sake plugin directory", nil, nil
    end
    local plugins_root = sake_dir:match("^(.*)/sake%.koplugin$")
    if not plugins_root then
        return false, "Cannot determine plugins root", nil, nil
    end
    local updater_path = plugins_root .. "/sakeUpdater.koplugin/updater.lua"
    local ok, mod_or_err = pcall(dofile, updater_path)
    if not ok then
        return false, tostring(mod_or_err), nil, nil
    end
    return true, mod_or_err, sake_dir, plugins_root
end

function Sake:startDeferredProgressWatcher()
    if self.progress_watcher_active then
        return
    end

    self.progress_watcher_active = true
    logger.info("[Sake] Started deferred progress watcher.")

    local function checkAndApply()
        if self.progressSync and self.progressSync.hasOpenDocument and self.progressSync:hasOpenDocument() then
            UIManager:scheduleIn(1.0, checkAndApply)
            return
        end

        self.progress_watcher_active = false
        logger.info("[Sake] Document closed. Running deferred progress sync now.")
        self:runProgressSync()
    end

    UIManager:scheduleIn(1.0, checkAndApply)
end

function Sake:runProgressSync(opts)
    local ok, result_or_err = self.progressSync:syncNewProgressForDevice(opts)
    if not ok then
        return false, result_or_err
    end

    local result = result_or_err
    if result.deferred then
        self:startDeferredProgressWatcher()
        return true
    end

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

    return true, result
end

function Sake:getPairActionLabel()
    local has_api_key = tostring(self.settings.api_key or "") ~= ""
    if has_api_key then
        return _("Refresh Device Key")
    end
    return _("Pair Device")
end

function Sake:showPairingSetupHint()
    local missing_steps = {}
    if not self.settings.api_url or self.settings.api_url == "" then
        table.insert(missing_steps, _("Set Server URL first in Setup."))
    end
    if not self.settings.device_name or self.settings.device_name == "" then
        table.insert(missing_steps, _("Set Device Name first in Setup."))
    end

    UIManager:show(InfoMessage:new{
        text = _("Pairing requires setup first.") .. "\n" .. table.concat(missing_steps, "\n"),
        timeout = 6,
    })
end

function Sake:beginPairDevice(username, password, touchmenu_instance)
    Settings.saveField(self.settings, "api_user", tostring(username or ""))
    Settings.saveField(self.settings, "api_pass", "")

    UIManager:show(InfoMessage:new{
        text = _("Pairing device. Please wait..."),
        timeout = 1
    })

    UIManager:scheduleIn(0.05, function()
        local session_settings = copyTable(self.settings)
        session_settings.api_user = tostring(username or "")
        session_settings.api_pass = tostring(password or "")

        local ok, api_key_or_err = self:fetchDeviceKey(session_settings)
        session_settings.api_pass = ""
        self.settings.api_user = session_settings.api_user
        self.settings.api_pass = ""
        self.settings.api_key = session_settings.api_key

        if ok and touchmenu_instance then
            touchmenu_instance:updateItems()
        end
    end)
end

function Sake:openPairingDialog(touchmenu_instance)
    local valid = Settings.validatePairingSetup(self.settings)
    if not valid then
        logger.info("[Sake] Pairing dialog blocked. Missing setup prerequisites.")
        self:showPairingSetupHint()
        return false
    end

    Dialogs.showPairingDialog(self.ctx, {
        title = self:getPairActionLabel(),
        ok_text = self:getPairActionLabel(),
        on_submit = function(username, password)
            self:beginPairDevice(username, password, touchmenu_instance)
        end,
    })

    return true
end

function Sake:fetchDeviceKey(session_settings)
    local settings = session_settings or self.settings

    if settings == self.settings then
        local valid, missing = Settings.validatePairingRequired(settings)
        if not valid then
            logger.info("[Sake] Device key fetch skipped. Missing settings: " .. tostring(missing))
            UIManager:show(InfoMessage:new{
                text = _("Missing settings: ") .. tostring(missing),
                timeout = 6
            })
            return false
        end
    end

    local session = Session:new(settings)
    local ok, api_key_or_err = session:fetchDeviceKey()
    if session_settings then
        session_settings.api_key = session.settings.api_key
        session_settings.api_pass = session.settings.api_pass
        session_settings.api_user = session.settings.api_user
    end
    if settings == self.settings then
        self.settings.api_key = session.settings.api_key
        self.settings.api_pass = session.settings.api_pass
        self.settings.api_user = session.settings.api_user
    end
    if not ok then
        local error_message = tostring(api_key_or_err)
        if type(api_key_or_err) == "table" then
            error_message =
                session:errorFromResponse(api_key_or_err)
                or api_key_or_err.request_error
                or ("HTTP Error " .. tostring(api_key_or_err.status_code))
        end

        logger.warn("[Sake] Device key fetch failed: " .. tostring(error_message))
        UIManager:show(InfoMessage:new{
            text = _("Pairing failed: ") .. tostring(error_message),
            timeout = 6
        })
        return false
    end

    logger.info("[Sake] Device key fetched successfully.")
    UIManager:show(InfoMessage:new{
        text = _("Pairing successful. Device key stored and login password cleared."),
        timeout = 5
    })
    return true
end

function Sake:uploadCurrentBookProgress()
    local ok, result_or_err = self.progressSync:syncCurrentBookProgress({
        no_remote_fallback = true,
    })
    if not ok then
        return false, result_or_err
    end

    local result = result_or_err or {}
    if result.no_document then
        UIManager:show(InfoMessage:new{
            text = _("Open a book to upload current progress."),
            timeout = 5
        })
        return true, result
    end

    if result.deferred then
        UIManager:show(InfoMessage:new{
            text = _("Progress upload deferred until the network is available."),
            timeout = 5
        })
        return true, result
    end

    if result.uploaded then
        UIManager:show(InfoMessage:new{
            text = _("Current book progress uploaded."),
            timeout = 4
        })
    end

    return true, result
end

function Sake:reportDeviceVersionOnStartup()
    local valid, missing = Settings.validateRequired(self.settings)
    if not valid then
        logger.info("[Sake] Device version report skipped. Missing settings: " .. tostring(missing))
        return
    end

    local session = Session:new(self.settings)
    local device_id = tostring(self.settings.device_name or "")
    local plugin_version = tostring((PluginMeta and PluginMeta.version) or "unknown")
    local ok, err = DeviceApi.reportVersion(session, device_id, plugin_version)
    if not ok then
        logger.warn("[Sake] Device version report failed: " .. tostring(err))
        return
    end

    logger.info("[Sake] Device version reported: " .. device_id .. " -> " .. plugin_version)
end

function Sake:checkPluginUpdate(opts)
    if not self.updater then
        if opts and opts.notify then
            UIManager:show(InfoMessage:new{
                text = _("Updater module not available."),
                timeout = 4
            })
        end
        return false
    end
    local ok, info_or_err = self.updater:checkForUpdate()
    if not ok then
        logger.warn("[Sake] Updater check failed: " .. tostring(info_or_err))
        if opts and opts.notify then
            UIManager:show(InfoMessage:new{
                text = _("Update check failed: ") .. tostring(info_or_err),
                timeout = 6
            })
        end
        return false
    end
    local info = info_or_err
    if info.update_available then
        UIManager:show(ConfirmBox:new{
            text = _("Sake update available: ") .. tostring(info.current_version) .. " -> " .. tostring(info.latest_version) .. _("\nDo you want to update now?"),
            ok_text = _("Update"),
            ok_callback = function()
                self:performPluginUpdate()
            end,
        })
    elseif opts and opts.notify then
        UIManager:show(InfoMessage:new{
            text = _("No update available."),
            timeout = 3
        })
    end
    return true
end

function Sake:performPluginUpdate()
    if not self.updater then
        UIManager:show(InfoMessage:new{
            text = _("Updater module not available."),
            timeout = 4
        })
        return
    end
    if not self.updater:isUpdateAvailable() then
        UIManager:show(InfoMessage:new{
            text = _("No update available."),
            timeout = 3
        })
        return
    end

    UIManager:show(InfoMessage:new{
        text = _("Updating Sake plugin..."),
        timeout = 2
    })

    UIManager:scheduleIn(0.1, function()
        local ok, err = self.updater:performUpdate()
        if not ok then
            UIManager:show(InfoMessage:new{
                text = _("Update failed: ") .. tostring(err),
                timeout = 6
            })
            return
        end
        UIManager:show(InfoMessage:new{
            text = _("Update complete. Please restart KOReader."),
            timeout = 8
        })
    end)
end

function Sake:onDispatcherRegisterActions()
    Dispatcher:registerAction("sake_action", {category="none", event="Sake", title="Sake", general=true,})
end

function Sake:init()
    self:onDispatcherRegisterActions()
    self.settings = Settings.load()
    logger.configure(self.settings)
    self.init_error_message = nil
    if has_sake_device and SakeDevice and SakeDevice.ensure then
        local ensured, device_or_err = pcall(SakeDevice.ensure, self.settings)
        if not ensured then
            logger.error("[Sake] Device setup failed: " .. tostring(device_or_err))
            self.init_error_message = _("Device setup failed: ") .. tostring(device_or_err)
        end
    else
        local err_msg = has_sake_device and "Unknown device module error" or tostring(SakeDevice)
        logger.error("[Sake] Failed to load local device module: " .. err_msg)
        self.init_error_message = _("Failed to load local device module: ") .. tostring(err_msg)
    end

    self.books_downloaded_bg = 0
    self.books_downloaded_bg_titles = {}
    self.bg_error_messages = {}
    self.progress_watcher_active = false
    self.updater = nil
    local device_name = tostring(self.settings.device_name or "Not Set")
    local api_url = (self.settings.api_url ~= "" and self.settings.api_url or "Not Set")
    logger.info("[Sake] Initialized. Device: " .. device_name .. " | URL: " .. api_url)

    self.ctx = {
        ui = self.ui,
        settings = self.settings,
        input_dialog = nil,
        actions = {},
    }

    self.bookSync = BookSync:new(self.ctx)
    self.libraryExport = LibraryExport:new(self.ctx)
    self.progressSync = ProgressSync:new(self.ctx)

    local updater_ok, updater_mod_or_err, sake_plugin_dir, plugins_root = loadUpdaterModule()
    if updater_ok and updater_mod_or_err and updater_mod_or_err.new then
        self.updater = updater_mod_or_err:new(self.ctx, {
            sake_plugin_dir = sake_plugin_dir,
            plugins_root = plugins_root,
        })
        logger.info("[Sake] Updater module loaded.")
    else
        logger.warn("[Sake] Updater module not loaded: " .. tostring(updater_mod_or_err))
    end

    self.ctx.actions.onSyncBooks = function() self.bookSync:syncNow() end
    self.ctx.actions.onPullProgress = function() self:runProgressSync() end
    self.ctx.actions.onUploadCurrentProgress = function() self:uploadCurrentBookProgress() end
    self.ctx.actions.onLibraryImportExport = function() self.libraryExport:start() end
    self.ctx.actions.onPairDevice = function(touchmenu_instance)
        self:openPairingDialog(touchmenu_instance)
    end
    self.ctx.actions.onCheckPluginUpdate = function() self:checkPluginUpdate({ notify = true }) end
    self.ctx.actions.onToggleLogShipping = function(touchmenu_instance)
        self:toggleLogShipping(touchmenu_instance)
    end
    self.ctx.actions.getPairActionLabel = function() return self:getPairActionLabel() end
    self.ctx.actions.showInput = function(field, title)
        Dialogs.showStringInput(self.ctx, field, title)
    end

    self.ui.menu:registerToMainMenu(self)

    UIManager:scheduleIn(0.1, function()
        self:reportDeviceVersionOnStartup()
    end)

    self.onSuspend = function() self:handleSuspend() end
    self.onResume = function() self:handleResume() end
end

function Sake:addToMainMenu(menu_items)
    Menu.addToMainMenu(menu_items, self.ctx)
end

function Sake:toggleLogShipping(touchmenu_instance)
    local currently_enabled = self.settings.log_shipping_enabled == true
    Settings.saveField(self.settings, "log_shipping_enabled", not currently_enabled)

    if self.settings.log_shipping_enabled ~= true then
        logger.clearPendingRemoteLogs()
    end

    if self.settings.log_shipping_enabled == true then
        logger.info("[Sake] Remote log shipping enabled.")
        UIManager:show(InfoMessage:new{
            text = _("Remote log shipping enabled."),
            timeout = 4
        })

        if touchmenu_instance then
            touchmenu_instance:updateItems()
        end
        return
    end

    logger.info("[Sake] Remote log shipping disabled.")
    UIManager:show(InfoMessage:new{
        text = _("Remote log shipping disabled."),
        timeout = 4
    })

    if touchmenu_instance then
        touchmenu_instance:updateItems()
    end
end

function Sake:handleSuspend()
    local valid, missing = Settings.validateRequired(self.settings)
    if not valid then
        logger.info("[Sake] Suspend sync skipped. Missing settings: " .. tostring(missing))
        self.bg_error_messages = { _("Background sync skipped: Missing ") .. tostring(missing) }
        return
    end

    logger.info("[Sake] Suspend detected. Starting background tasks...")
    self.bg_error_messages = {}

    UIManager:scheduleIn(1.0, function()
        local success, err = self.progressSync:syncCurrentBookProgress({ silent = true })
        if not success and err then
            table.insert(self.bg_error_messages, _("Progress sync failed: ") .. tostring(err))
        end
    end)

    UIManager:scheduleIn(1, function()
        logger.info("[Sake] Starting silent book sync...")
        local count, err, titles = self.bookSync:performSilentSync()
        self.books_downloaded_bg = count
        self.books_downloaded_bg_titles = titles or {}
        if err then
            table.insert(self.bg_error_messages, _("Book sync failed: ") .. tostring(err))
        end
        if count > 0 then
            logger.info("[Sake] Silent sync downloaded " .. count .. " " .. Utils.bookWord(count) .. ".")
        else
            logger.info("[Sake] Silent sync finished. No new books.")
        end
    end)

end

function Sake:handleResume()
    logger.info("[Sake] Resume detected.")
    if self.books_downloaded_bg and self.books_downloaded_bg > 0 then
        logger.info("[Sake] Alerting user of " .. self.books_downloaded_bg .. " background downloads.")
        local summary_text = Utils.downloadSummaryText(_("Welcome back!\nDownloaded"), self.books_downloaded_bg, self.books_downloaded_bg_titles, _(" while away."))
        UIManager:show(InfoMessage:new{ 
            text = summary_text,
            timeout = 5
        })
        self.books_downloaded_bg = 0
        self.books_downloaded_bg_titles = {}
    end
    if self.bg_error_messages and #self.bg_error_messages > 0 then
        UIManager:show(InfoMessage:new{
            text = _("Background sync errors:\n") .. table.concat(self.bg_error_messages, "\n"),
            timeout = 8
        })
        self.bg_error_messages = {}
    end

    -- local delay = 6.0
    -- logger.info("[Sake] Scheduling resume progress sync in " .. tostring(delay) .. "s.")
    -- UIManager:scheduleIn(delay, function()
    --     local ok, err = self:runProgressSync()
    --     if ok then
    --         return
    --     end

    --     logger.warn("[Sake] Resume progress sync failed. Error: " .. tostring(err))
    -- end)
end

function Sake:onReaderReady()
    if self.init_error_message then
        UIManager:show(InfoMessage:new{
            text = self.init_error_message,
            timeout = 8
        })
        self.init_error_message = nil
    end
    self:runProgressSync({ silent = true, silent_summary = true })
end

return Sake
