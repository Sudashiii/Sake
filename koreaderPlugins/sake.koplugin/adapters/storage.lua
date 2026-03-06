local Utils = require("core/utils")

local Storage = {}
Storage.__index = Storage

local function ensureParentDir(path)
    local parent = path:match("^(.*)/[^/]+$")
    if not parent or parent == "" then
        return true
    end

    local quoted_parent = "'" .. parent:gsub("'", "'\\''") .. "'"
    local ok = os.execute("mkdir -p " .. quoted_parent)
    if ok ~= true and ok ~= 0 then
        return false, "Failed to create parent directory: " .. tostring(parent)
    end

    return true
end

local function atomicWrite(path, content, mode, ensure_parent)
    if ensure_parent then
        local ok_parent, parent_err = ensureParentDir(path)
        if not ok_parent then
            return false, parent_err
        end
    end

    local temp_path = path .. ".part"
    local handle, open_err = io.open(temp_path, mode)
    if not handle then
        return false, "Cannot open file for writing: " .. tostring(open_err)
    end

    local ok, write_err = handle:write(content or "")
    handle:close()
    if not ok then
        os.remove(temp_path)
        return false, "Cannot write file: " .. tostring(write_err)
    end

    local renamed = os.rename(temp_path, path)
    if not renamed then
        os.remove(temp_path)
        return false, "Cannot move temporary file into place"
    end

    return true
end

function Storage:new(settings)
    return setmetatable({
        settings = settings or {},
    }, self)
end

function Storage:homeDir()
    return tostring(self.settings.home_dir or ".")
end

function Storage:metadataPathForDocument(doc_path)
    return string.gsub(doc_path, "%.([^%.]+)$", ".sdr/metadata.%1.lua")
end

function Storage:documentPaths(doc_path)
    if not doc_path or doc_path == "" then
        return false, "Could not determine document path"
    end

    local filename = Utils.basename(doc_path)
    if not filename then
        return false, "Could not determine file name"
    end

    return true, {
        doc_path = doc_path,
        filename = filename,
        sdr_path = self:metadataPathForDocument(doc_path),
    }
end

function Storage:pathsForStorageKey(storage_key)
    local local_filename = Utils.sanitizeFilename(storage_key)
    local book_path = self:homeDir() .. "/" .. local_filename

    return {
        book_path = book_path,
        sdr_path = self:metadataPathForDocument(book_path),
        local_filename = local_filename,
    }
end

function Storage:readText(path)
    local handle = io.open(path, "r")
    if not handle then
        return false, "Metadata file not found: " .. tostring(path)
    end

    local content = handle:read("*all")
    handle:close()
    return true, content
end

function Storage:writeText(path, content)
    local ok, err = atomicWrite(path, content, "w", true)
    if not ok then
        return false, err
    end
    return true
end

function Storage:saveBook(storage_key, content)
    local paths = self:pathsForStorageKey(storage_key)
    local ok, err = atomicWrite(paths.book_path, content, "wb", true)
    if not ok then
        return false, err
    end
    return true, paths.book_path
end

function Storage:bookExists(storage_key)
    local paths = self:pathsForStorageKey(storage_key)
    local handle = io.open(paths.book_path, "rb")
    if not handle then
        return false, paths
    end

    handle:close()
    return true, paths
end

return Storage
