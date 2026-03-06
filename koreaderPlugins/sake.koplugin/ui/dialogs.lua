local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local UIManager = require("ui/uimanager")
local logger = require("logger")
local _ = require("gettext")

local Settings = require("core/settings")

local Dialogs = {}

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

return Dialogs
