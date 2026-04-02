local ConfirmBox = require("ui/widget/confirmbox")
local InfoMessage = require("ui/widget/infomessage")
local UIManager = require("ui/uimanager")
local logger = require("core/log")
local _ = require("gettext")

local LibraryExportEngine = require("engines/library_export_engine")

local LibraryExport = {}
LibraryExport.__index = LibraryExport

local function closePopup(self)
    if self.popup then
        UIManager:close(self.popup)
        self.popup = nil
    end
end

local function buildSummaryText(summary)
    local lines = {
        string.format("Export complete.\nScanned %d books.", summary.scanned),
        string.format(
            "Created %d, duplicates %d, failed %d.",
            summary.created,
            summary.duplicates,
            summary.failed
        ),
        string.format(
            "Sidecars imported %d, skipped as older %d, missing %d.",
            summary.sidecars_imported,
            summary.sidecars_skipped_older,
            summary.sidecars_missing
        ),
    }

    if #summary.errors > 0 then
        table.insert(lines, "")
        table.insert(lines, "Errors:")
        local max_errors = math.min(#summary.errors, 5)
        for index = 1, max_errors do
            table.insert(lines, "- " .. tostring(summary.errors[index]))
        end
        if #summary.errors > max_errors then
            table.insert(lines, string.format("...and %d more.", #summary.errors - max_errors))
        end
    end

    return table.concat(lines, "\n")
end

function LibraryExport:new(ctx)
    return setmetatable({
        popup = nil,
        engine = LibraryExportEngine:new(ctx),
    }, self)
end

function LibraryExport:showError(message)
    local text = _("Error: ") .. tostring(message)
    logger.warn("[Sake] " .. text)
    UIManager:show(InfoMessage:new{
        text = text,
        timeout = 6
    })
end

function LibraryExport:startExport()
    logger.info("[Sake] Existing-library export started.")

    self.popup = InfoMessage:new{
        text = _("Scanning library for exportable books..."),
        timeout = nil
    }
    UIManager:show(self.popup)

    UIManager:scheduleIn(0.05, function()
        local ok_scan, books_or_err = self.engine:scanLibraryBooks()

        closePopup(self)

        if not ok_scan then
            self:showError(books_or_err)
            return
        end

        local books = books_or_err
        if #books == 0 then
            UIManager:show(InfoMessage:new{
                text = _("No EPUB, PDF, or MOBI files found in the configured home directory."),
                timeout = 6
            })
            return
        end

        self:startQueue(books, 1, {
            scanned = #books,
            created = 0,
            duplicates = 0,
            failed = 0,
            sidecars_imported = 0,
            sidecars_skipped_older = 0,
            sidecars_missing = 0,
            errors = {},
        })
    end)
end

function LibraryExport:start()
    UIManager:show(ConfirmBox:new{
        text = _(
            "Importing or exporting an existing library can take a while.\n"
            .. "Your device may be unusable until the process finishes.\n\n"
            .. "Do you want to continue?"
        ),
        ok_text = _("Continue"),
        ok_callback = function()
            self:startExport()
        end,
    })
end

function LibraryExport:startQueue(books, index, summary)
    closePopup(self)

    if index > #books then
        UIManager:show(InfoMessage:new{
            text = buildSummaryText(summary),
            timeout = 10
        })
        return
    end

    local book = books[index]
    local msg = string.format("Exporting %d of %d\n\n%s", index, #books, tostring(book.filename or "Unknown"))
    self.popup = InfoMessage:new{
        text = msg,
        timeout = nil,
    }
    UIManager:show(self.popup)

    UIManager:scheduleIn(0.1, function()
        local ok_call, ok_export, result_or_err = pcall(function()
            return self.engine:exportBook(book)
        end)

        if not ok_call then
            local panic_err = ok_export
            ok_export = false
            result_or_err = "Unexpected export error: " .. tostring(panic_err)
        end

        if ok_export then
            if result_or_err.bookOutcome == "created" then
                summary.created = summary.created + 1
            else
                summary.duplicates = summary.duplicates + 1
            end

            if result_or_err.sidecarOutcome == "imported" then
                summary.sidecars_imported = summary.sidecars_imported + 1
            elseif result_or_err.sidecarOutcome == "skipped_older" then
                summary.sidecars_skipped_older = summary.sidecars_skipped_older + 1
            else
                summary.sidecars_missing = summary.sidecars_missing + 1
            end
        else
            summary.failed = summary.failed + 1
            table.insert(
                summary.errors,
                tostring(book.filename or "Unknown") .. ": " .. tostring(result_or_err)
            )
            logger.warn("[Sake] Export failed for " .. tostring(book.filename or "Unknown") .. ": " .. tostring(result_or_err))
        end

        self:startQueue(books, index + 1, summary)
    end)
end

return LibraryExport
