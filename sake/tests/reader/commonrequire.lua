require("dbg"):turnOff()
local logger = require("logger")
logger:setLevel(logger.levels.warn)
require("ffi/loadlib")

local DataStorage = require("datastorage")
require("libs/libkoreader-lfs").mkdir(DataStorage:getHistoryDir())

os.remove(DataStorage:getDataDir() .. "/defaults.tests.lua")
os.remove(DataStorage:getDataDir() .. "/defaults.tests.lua.old")
G_defaults = require("luadefaults"):open(DataStorage:getDataDir() .. "/defaults.tests.lua")

os.remove(DataStorage:getDataDir() .. "/settings.tests.lua")
os.remove(DataStorage:getDataDir() .. "/settings.tests.lua.old")
G_reader_settings = require("luasettings"):open(DataStorage:getDataDir() .. "/settings.tests.lua")
G_reader_settings:saveSetting("document_metadata_folder", "dir")

einkfb = require("ffi/framebuffer")
einkfb.dummy = true

local Device = require("device")
Device.screen:init()
require("document/canvascontext"):init(Device)
Device.input.dummy = true

function disable_plugins()
    local PluginLoader = require("pluginloader")
    PluginLoader.enabled_plugins = {}
    PluginLoader.disabled_plugins = {}
    PluginLoader.loaded_plugins = {}
end
