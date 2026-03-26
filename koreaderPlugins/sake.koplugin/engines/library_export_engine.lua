local ExportApi = require("api/export")
local Session = require("api/session")
local Storage = require("adapters/storage")
local Settings = require("core/settings")
local Utils = require("core/utils")

local LibraryExportEngine = {}
LibraryExportEngine.__index = LibraryExportEngine

function LibraryExportEngine:new(ctx)
    local settings = ctx.settings
    return setmetatable({
        settings = settings,
        session = Session:new(settings),
        storage = Storage:new(settings),
    }, self)
end

function LibraryExportEngine:validateSettings()
    local ok, missing = Settings.validateRequired(self.settings)
    if not ok then
        return false, "Please configure: " .. tostring(missing)
    end
    return true
end

function LibraryExportEngine:scanLibraryBooks()
    local valid, err = self:validateSettings()
    if not valid then
        return false, err
    end

    return self.storage:scanExportableBooks()
end

function LibraryExportEngine:exportBook(book)
    local valid, err = self:validateSettings()
    if not valid then
        return false, err
    end

    local ok_content, file_content_or_err = self.storage:readBinary(book.doc_path)
    if not ok_content then
        return false, file_content_or_err
    end

    local sidecar_content = nil
    local sidecar_name = nil
    if self.storage:fileExists(book.sdr_path) then
        local ok_sidecar, sidecar_or_err = self.storage:readText(book.sdr_path)
        if not ok_sidecar then
            return false, sidecar_or_err
        end
        sidecar_content = sidecar_or_err
        sidecar_name = Utils.basename(book.sdr_path) or "metadata.lua"
    end

    return ExportApi.exportBook(
        self.session,
        self.settings.device_name,
        book.filename,
        file_content_or_err,
        sidecar_name,
        sidecar_content
    )
end

return LibraryExportEngine
