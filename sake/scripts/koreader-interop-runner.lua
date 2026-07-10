local raw_assert = _G.assert

local function same(left, right, seen)
    if left == right then return true end
    if type(left) ~= "table" or type(right) ~= "table" then return false end
    seen = seen or {}
    if seen[left] == right then return true end
    seen[left] = right
    for key, value in pairs(left) do
        if not same(value, right[key], seen) then return false end
    end
    for key in pairs(right) do
        if left[key] == nil then return false end
    end
    return true
end

_G.assert = setmetatable({
    is_true = function(value) raw_assert(value == true) end,
    are = { same = function(expected, actual) raw_assert(same(expected, actual)) end },
}, { __call = function(_, value, message) return raw_assert(value, message) end })

local before, after
function setup(fn) before = fn end
function teardown(fn) after = fn end
function describe(_, fn) fn() end
function it(name, fn)
    before()
    local ok, err = pcall(fn)
    after()
    if not ok then error(name .. ": " .. tostring(err), 0) end
    print("ok - " .. name)
end

dofile(assert(arg[1], "missing spec path"))
