local Utils = {}

function Utils.formatSize(bytes)
    if not bytes then return "Unknown" end
    local mb = bytes / 1024 / 1024
    return string.format("%.2f MB", mb)
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
