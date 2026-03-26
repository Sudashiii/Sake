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

    local sidecar_name = nil
    local sidecar_path = nil
    if self.storage:fileExists(book.sdr_path) then
        sidecar_path = book.sdr_path
        sidecar_name = Utils.basename(book.sdr_path) or "metadata.lua"
    end

    return ExportApi.exportBook(
        self.session,
        self.settings.device_name,
        book.filename,
        book.doc_path,
        sidecar_name,
        sidecar_path
    )
end

return LibraryExportEngine
