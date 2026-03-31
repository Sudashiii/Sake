local _ = require("gettext")

local Menu = {}

function Menu.addToMainMenu(menu_items, ctx)
    local sub_items = {
        {
            text = _("Sync Books Now"),
            callback = function()
                ctx.actions.onSync()
            end,
        },
        {
            text = _("Sync Progress Now"),
            callback = function()
                ctx.actions.onProgressSync()
            end,
        },
        {
            text = _("Export Existing Library"),
            callback = function()
                ctx.actions.onExportLibrary()
            end,
        },
        {
            text = _("Check Plugin Updates"),
            callback = function()
                ctx.actions.onCheckPluginUpdate()
            end,
        },
        {
            text = _("Send Logs to Sake"),
            checked_func = function()
                return ctx.settings.log_shipping_enabled == true
            end,
            callback = function(touchmenu_instance)
                ctx.actions.onToggleLogShipping(touchmenu_instance)
            end,
        },
    }

    table.insert(sub_items, {
        text = _("Set API URL"),
        keep_menu_open = true,
        callback = function() ctx.actions.showInput("api_url", "Enter API URL") end,
    })
    table.insert(sub_items, {
        text = _("Set Login Username"),
        keep_menu_open = true,
        callback = function() ctx.actions.showInput("api_user", "Enter Login Username") end,
    })
    table.insert(sub_items, {
        text = _("Set Login Password"),
        keep_menu_open = true,
        callback = function() ctx.actions.showInput("api_pass", "Enter Login Password") end,
    })
    table.insert(sub_items, {
        text = _("Set Device Name"),
        keep_menu_open = true,
        callback = function() ctx.actions.showInput("device_name", "Enter Device Name") end,
    })
    table.insert(sub_items, {
        text = _("Login and Fetch Device Key"),
        callback = function()
            ctx.actions.onFetchDeviceKey()
        end,
    })

    menu_items.sake = {
        text = _("Sake"),
        sorting_hint = "more_tools",
        sub_item_table = sub_items
    }
end

return Menu
