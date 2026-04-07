local _ = require("gettext")

local Menu = {}

function Menu.addToMainMenu(menu_items, ctx)
    menu_items.sake = {
        text = _("Sake"),
        sorting_hint = "more_tools",
        sub_item_table = {
            {
                text = _("Sync"),
                sub_item_table = {
                    {
                        text = _("Download New Books"),
                        callback = function()
                            ctx.actions.onSyncBooks()
                        end,
                    },
                    {
                        text = _("Pull Progress From Other Devices"),
                        callback = function()
                            ctx.actions.onPullProgress()
                        end,
                    },
                    {
                        text = _("Upload Current Book Progress"),
                        callback = function()
                            ctx.actions.onUploadCurrentProgress()
                        end,
                    },
                },
            },
            {
                text = _("Setup"),
                sub_item_table = {
                    {
                        text = _("Server URL"),
                        keep_menu_open = true,
                        callback = function()
                            ctx.actions.showInput("api_url", "Enter Server URL")
                        end,
                    },
                    {
                        text = _("Device Name"),
                        keep_menu_open = true,
                        callback = function()
                            ctx.actions.showInput("device_name", "Enter Device Name")
                        end,
                    },
                    {
                        text_func = function()
                            return ctx.actions.getPairActionLabel()
                        end,
                        keep_menu_open = true,
                        callback = function(touchmenu_instance)
                            ctx.actions.onPairDevice(touchmenu_instance)
                        end,
                    },
                },
            },
            {
                text = _("Library Import/Export"),
                sub_item_table = {
                    {
                        text = _("Export Device Library to App"),
                        callback = function()
                            ctx.actions.onLibraryImportExport()
                        end,
                    },
                },
            },
            {
                text = _("Maintenance"),
                sub_item_table = {
                    {
                        text = _("Check for Plugin Updates"),
                        callback = function()
                            ctx.actions.onCheckPluginUpdate()
                        end,
                    },
                    {
                        text = _("Install Specific Plugin Version"),
                        callback = function()
                            ctx.actions.onOpenPluginVersionPicker()
                        end,
                    },
                    {
                        text = _("Advanced"),
                        sub_item_table = {
                            {
                                text = _("Remote Log Shipping"),
                                checked_func = function()
                                    return ctx.settings.log_shipping_enabled == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleLogShipping(touchmenu_instance)
                                end,
                            },
                            {
                                text = _("Disable Automatic Book Sync (Wakeup)"),
                                checked_func = function()
                                    return ctx.settings.disable_automatic_book_sync_wakeup == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleAutomaticBookSyncWakeup(touchmenu_instance)
                                end,
                            },
                            {
                                text = _("Disable Automatic Progress Download (Wakeup)"),
                                checked_func = function()
                                    return ctx.settings.disable_automatic_progress_download_wakeup == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleAutomaticProgressDownloadWakeup(touchmenu_instance)
                                end,
                            },
                            {
                                text = _("Disable Automatic Progress Download (Reader Ready)"),
                                checked_func = function()
                                    return ctx.settings.disable_automatic_progress_download_reader_ready == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleAutomaticProgressDownloadReaderReady(touchmenu_instance)
                                end,
                            },
                            {
                                text = _("Disable Automatic Progress Sync (Sleep)"),
                                checked_func = function()
                                    return ctx.settings.disable_automatic_progress_sync_sleep == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleAutomaticProgressSyncSleep(touchmenu_instance)
                                end,
                            },
                            {
                                text = _("Disable Automatic Progress Sync (Leaving Current Book)"),
                                checked_func = function()
                                    return ctx.settings.disable_automatic_progress_sync_close == true
                                end,
                                callback = function(touchmenu_instance)
                                    ctx.actions.onToggleAutomaticProgressSyncClose(touchmenu_instance)
                                end,
                            },
                        },
                    },
                },
            },
        },
    }
end

return Menu
