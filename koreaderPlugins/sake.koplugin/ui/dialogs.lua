local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local MultiInputDialog = require("ui/widget/multiinputdialog")
local UIManager = require("ui/uimanager")
local logger = require("core/log")
local _ = require("gettext")

local Settings = require("core/settings")

local Dialogs = {}

local function trim(value)
    return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

function Dialogs.showStringInput(ctx, field, title)
    ctx.input_dialog = InputDialog:new{
        title = _(title),
        input = ctx.settings[field],
        input_type = "string",
        buttons = {
            {
                {
                    text = _("Cancel"),
                    id = "close",
                    callback = function() UIManager:close(ctx.input_dialog) end,
                },
                {
                    text = _("Save"),
                    callback = function()
                        local new_val = ctx.input_dialog:getInputText()
                        local key = Settings.keyFor(field)
                        if not key then
                            logger.error("[Sake] Unknown settings field: " .. tostring(field))
                            UIManager:show(InfoMessage:new{ text = _("Unable to save setting.") })
                            return
                        end
                        Settings.saveField(ctx.settings, field, new_val)

                        local displayed_val = field == "api_pass" and "***" or tostring(new_val)
                        logger.info("[Sake] Updated setting: " .. key .. " = " .. displayed_val)

                        UIManager:close(ctx.input_dialog)
                        UIManager:show(InfoMessage:new{ text = _("Saved!") })
                    end,
                },
            },
        },
    }
    UIManager:show(ctx.input_dialog)
    ctx.input_dialog:onShowKeyboard()
end

function Dialogs.showPairingDialog(ctx, opts)
    local dialog
    dialog = MultiInputDialog:new{
        title = opts.title or _("Pair Device"),
        fields = {
            {
                text = ctx.settings.api_user or "",
                hint = _("Username"),
            },
            {
                text = "",
                hint = _("Password"),
                text_type = "password",
            },
        },
        buttons = {
            {
                {
                    text = _("Cancel"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                    end,
                },
                {
                    text = opts.ok_text or _("Pair Device"),
                    callback = function()
                        local username, password = unpack(dialog:getFields())
                        username = trim(username)
                        password = tostring(password or "")

                        if username == "" and trim(password) == "" then
                            UIManager:show(InfoMessage:new{
                                text = _("Enter your username and password."),
                                timeout = 4,
                            })
                            return
                        end

                        if username == "" then
                            UIManager:show(InfoMessage:new{
                                text = _("Enter your username."),
                                timeout = 4,
                            })
                            return
                        end

                        if trim(password) == "" then
                            UIManager:show(InfoMessage:new{
                                text = _("Enter your password."),
                                timeout = 4,
                            })
                            return
                        end

                        UIManager:close(dialog)
                        if opts.on_submit then
                            opts.on_submit(username, password)
                        end
                    end,
                },
            },
        },
    }

    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

return Dialogs
