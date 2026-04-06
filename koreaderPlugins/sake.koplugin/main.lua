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
local Network = require("adapters/network")
local PluginMeta = require("_meta")

local Sake = WidgetContainer:extend{
    name = "sake",
    is_doc_only = false,
}

local CloseUploadBridge = {
    pending = nil,
    next_token = 0,
}

local CLOSE_UPLOAD_SETTLE_SECONDS = 0.1

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

local function readUpdaterVersion(plugins_root)
    if not plugins_root then
        return nil, "Cannot determine plugins root"
    end

    local meta_path = plugins_root .. "/sakeUpdater.koplugin/_meta.lua"
    local ok, meta_or_err = pcall(dofile, meta_path)
    if not ok or type(meta_or_err) ~= "table" then
        return nil, "Failed to read Sake Updater _meta.lua"
    end
    if not meta_or_err.version then
        return nil, "Sake Updater _meta.lua has no version"
    end

    return tostring(meta_or_err.version)
end

local function parseVersion(version)
    local parts = {}
    for n in tostring(version or ""):gmatch("(%d+)") do
        table.insert(parts, tonumber(n))
    end
    if #parts == 0 then
        return nil
    end
    return parts
end

local function isVersionAtLeast(version, minimum)
    local a = parseVersion(version)
    local b = parseVersion(minimum)
    if not a or not b then
        return false
    end

    local max_len = math.max(#a, #b)
    for i = 1, max_len do
        local av = a[i] or 0
        local bv = b[i] or 0
        if av > bv then return true end
        if av < bv then return false end
    end

    return true
end

function Sake:startDeferredProgressWatcher()
    if self.progress_watcher_active then
        return
    end

    self.progress_watcher_active = true
    logger.info("[Sake] Started deferred progress watcher.")

    local function checkAndApply()
        if self.progressSync and self.progressSync.isReloadInProgress and self.progressSync:isReloadInProgress() then
            UIManager:scheduleIn(1.0, checkAndApply)
            return
        end

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

    return true, result
end

function Sake:shouldSkipAutomaticSyncForOffline(label)
    if not self.network or self.network:isOnline() then
        return false
    end

    logger.info("[Sake] Skipping automatic " .. tostring(label) .. " because the device is offline.")
    return true
end

function Sake:clearPendingCloseUpload(token)
    if not CloseUploadBridge.pending then
        return
    end

    if token ~= nil and CloseUploadBridge.pending.token ~= token then
        return
    end

    CloseUploadBridge.pending = nil
end

function Sake:isAutomaticBookSyncWakeupDisabled()
    return self.settings.disable_automatic_book_sync_wakeup == true
end

function Sake:isAutomaticProgressDownloadWakeupDisabled()
    return self.settings.disable_automatic_progress_download_wakeup == true
end

function Sake:isAutomaticProgressDownloadReaderReadyDisabled()
    return self.settings.disable_automatic_progress_download_reader_ready == true
end

function Sake:isAutomaticProgressSyncSleepDisabled()
    return self.settings.disable_automatic_progress_sync_sleep == true
end

function Sake:isAutomaticProgressSyncCloseDisabled()
    return self.settings.disable_automatic_progress_sync_close == true
end

function Sake:schedulePendingCloseUpload(token)
    UIManager:scheduleIn(CLOSE_UPLOAD_SETTLE_SECONDS, function()
        local pending = CloseUploadBridge.pending
        if not pending or pending.token ~= token then
            return
        end

        if self:shouldSkipAutomaticSyncForOffline("progress sync on close") then
            self:clearPendingCloseUpload(token)
            return
        end

        if self:isAutomaticProgressSyncCloseDisabled() then
            logger.info("[Sake] Skipping close-triggered progress upload because automatic close sync is disabled.")
            self:clearPendingCloseUpload(token)
            return
        end

        if pending.reopened then
            logger.info("[Sake] Skipping close-triggered progress upload because a new reader opened immediately.")
            self:clearPendingCloseUpload(token)
            return
        end

        logger.info("[Sake] Uploading flushed sidecar for closed book: " .. tostring(pending.doc_path))
        local ok, err = self.progressSync:uploadClosedBookProgress(pending.doc_path, { silent = true })
        if not ok then
            logger.warn("[Sake] Close-triggered progress upload failed: " .. tostring(err))
        end

        self:clearPendingCloseUpload(token)
    end)
end

function Sake:onCloseDocument()
    if self:isAutomaticProgressSyncCloseDisabled() then
        logger.info("[Sake] Skipping close-upload capture because automatic close sync is disabled.")
        self:clearPendingCloseUpload()
        return
    end

    if not self.progressSync or (self.progressSync.isReloadInProgress and self.progressSync:isReloadInProgress()) then
        logger.info("[Sake] Skipping close-upload capture during reload teardown.")
        self:clearPendingCloseUpload()
        return
    end

    if not self.ui or not self.ui.document or not self.ui.document.file then
        logger.info("[Sake] CloseDocument observed without an active document.")
        self:clearPendingCloseUpload()
        return
    end

    local ok_doc, paths_or_err = self.progressSync.engine.storage:documentPaths(self.ui.document.file)
    if not ok_doc then
        logger.warn("[Sake] Failed to capture pending close upload: " .. tostring(paths_or_err))
        self:clearPendingCloseUpload()
        return
    end

    CloseUploadBridge.next_token = CloseUploadBridge.next_token + 1
    CloseUploadBridge.pending = {
        token = CloseUploadBridge.next_token,
        doc_path = paths_or_err.doc_path,
        filename = paths_or_err.filename,
        sdr_path = paths_or_err.sdr_path,
        reopened = false,
    }

    logger.info("[Sake] Captured pending close upload for: " .. tostring(paths_or_err.doc_path))
end

function Sake:onCloseWidget()
    local pending = CloseUploadBridge.pending
    if not pending then
        return
    end

    if self.progressSync and self.progressSync.isReloadInProgress and self.progressSync:isReloadInProgress() then
        logger.info("[Sake] Skipping close-triggered progress upload because a reload is in progress.")
        self:clearPendingCloseUpload(pending.token)
        return
    end

    self:schedulePendingCloseUpload(pending.token)
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
    self:performPluginUpdateWithRelease(nil)
end

function Sake:performPluginUpdateWithRelease(target_release)
    if not self.updater then
        UIManager:show(InfoMessage:new{
            text = _("Updater module not available."),
            timeout = 4
        })
        return
    end
    if not target_release and not self.updater:isUpdateAvailable() then
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
        local ok, err = self.updater:performUpdate(target_release)
        if not ok then
            if tostring(err) == "Selected version is already installed" then
                UIManager:show(InfoMessage:new{
                    text = _("That plugin version is already installed."),
                    timeout = 4
                })
                return
            end
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

function Sake:openPluginVersionPicker()
    if not self.updater then
        UIManager:show(InfoMessage:new{
            text = _("Updater module not available."),
            timeout = 4
        })
        return
    end

    local updater_version, updater_version_err = readUpdaterVersion(self.plugins_root)
    if not updater_version or not isVersionAtLeast(updater_version, "1.1.0") then
        logger.warn("[Sake] Specific version install blocked. Updater version: " .. tostring(updater_version or updater_version_err))
        UIManager:show(InfoMessage:new{
            text = _("Install Specific Plugin Version requires Sake Updater 1.1.0 or newer."),
            timeout = 6
        })
        return
    end

    local ok, result_or_err = self.updater:listReleases()
    if not ok then
        logger.warn("[Sake] Plugin release list failed: " .. tostring(result_or_err))
        UIManager:show(InfoMessage:new{
            text = _("Could not load plugin versions: ") .. tostring(result_or_err),
            timeout = 6
        })
        return
    end

    local result = result_or_err
    if not result.releases or #result.releases == 0 then
        UIManager:show(InfoMessage:new{
            text = _("No plugin versions available."),
            timeout = 4
        })
        return
    end

    Dialogs.showPluginVersionPicker(self.ctx, {
        current_version = result.current_version,
        releases = result.releases,
        on_select = function(release)
            if release and tostring(release.version or "") == tostring(result.current_version or "") then
                UIManager:show(InfoMessage:new{
                    text = _("That plugin version is already installed."),
                    timeout = 4
                })
                return
            end

            self:performPluginUpdateWithRelease(release)
        end,
    })
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
    self.plugins_root = nil
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
    self.network = Network:new()

    local updater_ok, updater_mod_or_err, sake_plugin_dir, plugins_root = loadUpdaterModule()
    if updater_ok and updater_mod_or_err and updater_mod_or_err.new then
        self.updater = updater_mod_or_err:new(self.ctx, {
            sake_plugin_dir = sake_plugin_dir,
            plugins_root = plugins_root,
        })
        self.plugins_root = plugins_root
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
    self.ctx.actions.onOpenPluginVersionPicker = function() self:openPluginVersionPicker() end
    self.ctx.actions.onToggleLogShipping = function(touchmenu_instance)
        self:toggleLogShipping(touchmenu_instance)
    end
    self.ctx.actions.onToggleAutomaticBookSyncWakeup = function(touchmenu_instance)
        self:toggleAutomaticBookSyncWakeup(touchmenu_instance)
    end
    self.ctx.actions.onToggleAutomaticProgressDownloadWakeup = function(touchmenu_instance)
        self:toggleAutomaticProgressDownloadWakeup(touchmenu_instance)
    end
    self.ctx.actions.onToggleAutomaticProgressDownloadReaderReady = function(touchmenu_instance)
        self:toggleAutomaticProgressDownloadReaderReady(touchmenu_instance)
    end
    self.ctx.actions.onToggleAutomaticProgressSyncSleep = function(touchmenu_instance)
        self:toggleAutomaticProgressSyncSleep(touchmenu_instance)
    end
    self.ctx.actions.onToggleAutomaticProgressSyncClose = function(touchmenu_instance)
        self:toggleAutomaticProgressSyncClose(touchmenu_instance)
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

function Sake:toggleBooleanSetting(field, touchmenu_instance, enabled_message, disabled_message, enabled_log, disabled_log)
    local currently_enabled = self.settings[field] == true
    Settings.saveField(self.settings, field, not currently_enabled)

    local is_enabled = self.settings[field] == true
    if is_enabled then
        logger.info("[Sake] " .. tostring(enabled_log))
        UIManager:show(InfoMessage:new{
            text = _(enabled_message),
            timeout = 4
        })
    else
        logger.info("[Sake] " .. tostring(disabled_log))
        UIManager:show(InfoMessage:new{
            text = _(disabled_message),
            timeout = 4
        })
    end

    if touchmenu_instance then
        touchmenu_instance:updateItems()
    end
end

function Sake:toggleAutomaticBookSyncWakeup(touchmenu_instance)
    self:toggleBooleanSetting(
        "disable_automatic_book_sync_wakeup",
        touchmenu_instance,
        "Automatic book sync on wakeup disabled.",
        "Automatic book sync on wakeup enabled.",
        "Automatic book sync on wakeup disabled.",
        "Automatic book sync on wakeup enabled."
    )
end

function Sake:toggleAutomaticProgressSyncSleep(touchmenu_instance)
    self:toggleBooleanSetting(
        "disable_automatic_progress_sync_sleep",
        touchmenu_instance,
        "Automatic progress sync on sleep disabled.",
        "Automatic progress sync on sleep enabled.",
        "Automatic progress sync on sleep disabled.",
        "Automatic progress sync on sleep enabled."
    )
end

function Sake:toggleAutomaticProgressDownloadWakeup(touchmenu_instance)
    self:toggleBooleanSetting(
        "disable_automatic_progress_download_wakeup",
        touchmenu_instance,
        "Automatic progress download on wakeup disabled.",
        "Automatic progress download on wakeup enabled.",
        "Automatic progress download on wakeup disabled.",
        "Automatic progress download on wakeup enabled."
    )
end

function Sake:toggleAutomaticProgressDownloadReaderReady(touchmenu_instance)
    self:toggleBooleanSetting(
        "disable_automatic_progress_download_reader_ready",
        touchmenu_instance,
        "Automatic progress download on reader ready disabled.",
        "Automatic progress download on reader ready enabled.",
        "Automatic progress download on reader ready disabled.",
        "Automatic progress download on reader ready enabled."
    )
end

function Sake:toggleAutomaticProgressSyncClose(touchmenu_instance)
    self:toggleBooleanSetting(
        "disable_automatic_progress_sync_close",
        touchmenu_instance,
        "Automatic progress sync when leaving the current book disabled.",
        "Automatic progress sync when leaving the current book enabled.",
        "Automatic progress sync when leaving the current book disabled.",
        "Automatic progress sync when leaving the current book enabled."
    )
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

    if self:shouldSkipAutomaticSyncForOffline("sync on sleep") then
        return
    end

    if self:isAutomaticProgressSyncSleepDisabled() then
        logger.info("[Sake] Skipping automatic progress sync on sleep because it is disabled.")
    else
        UIManager:scheduleIn(1.0, function()
            local success, err = self.progressSync:syncCurrentBookProgress({ silent = true })
            if not success and err then
                table.insert(self.bg_error_messages, _("Progress sync failed: ") .. tostring(err))
            end
        end)
    end

    if self:isAutomaticBookSyncWakeupDisabled() then
        logger.info("[Sake] Skipping automatic book sync for wakeup because it is disabled.")
    else
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

    if self:shouldSkipAutomaticSyncForOffline("sync on wakeup") then
        return
    end

    if self:isAutomaticProgressDownloadWakeupDisabled() then
        logger.info("[Sake] Skipping automatic progress download on wakeup because it is disabled.")
        return
    end

    local ok, err = self:runProgressSync()
    if ok then
        return
    end

    logger.warn("[Sake] Resume progress sync failed. Error: " .. tostring(err))
end

function Sake:onReaderReady()
    if CloseUploadBridge.pending then
        CloseUploadBridge.pending.reopened = true
        logger.info("[Sake] Marked pending close upload as reopened due to ReaderReady.")
    end

    if self.init_error_message then
        UIManager:show(InfoMessage:new{
            text = self.init_error_message,
            timeout = 8
        })
        self.init_error_message = nil
    end

    if self:shouldSkipAutomaticSyncForOffline("progress download on reader ready") then
        return
    end

    if self:isAutomaticProgressDownloadReaderReadyDisabled() then
        logger.info("[Sake] Skipping automatic progress download on reader ready because it is disabled.")
        return
    end

    self:runProgressSync({ silent = true, silent_summary = true })
end

return Sake
