local Utils = {}

function Utils.formatSize(bytes)
    if not bytes then return "Unknown" end
    local mb = bytes / 1024 / 1024
    return string.format("%.2f MB", mb)
end

function Utils.bookWord(count)
    return tonumber(count) == 1 and "book" or "books"
end

function Utils.bookTitles(books)
    local titles = {}
    for _, book in ipairs(books or {}) do
        table.insert(titles, tostring(book.title or "Unknown"))
    end
    return titles
end

function Utils.downloadSummaryText(prefix, count, titles, suffix)
    local line = string.format("%s %d %s", tostring(prefix or ""), tonumber(count) or 0, Utils.bookWord(count))
    if suffix and suffix ~= "" then
        line = line .. tostring(suffix)
    end

    if not titles or #titles == 0 then
        return line
    end

    return line .. "\n\n" .. table.concat(titles, "\n")
end

function Utils.sanitizeFilename(name)
    name = tostring(name or "")
    name = string.gsub(name, "%s+", "_")
    name = string.gsub(name, "[^%w%._%-]", "")
    if name == "" then
        return "download.bin"
    end
    return name
end

function Utils.basename(path)
    if not path or path == "" then
        return nil
    end
    return path:match("^.+/(.+)$") or path
end

return Utils
