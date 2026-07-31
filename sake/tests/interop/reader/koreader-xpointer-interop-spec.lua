describe("Sake web reader normalized EPUB XPointers", function()
    local DocumentRegistry, ReaderUI, Screen
    local readerui
    local document

    setup(function()
        require("commonrequire")
        disable_plugins()
        DocumentRegistry = require("document/documentregistry")
        ReaderUI = require("apps/reader/readerui")
        Screen = require("device").screen
        readerui = ReaderUI:new{
            dimen = Screen:getSize(),
            document = DocumentRegistry:openDocument(assert(os.getenv("SAKE_READER_TEST_EPUB"))),
        }
        document = readerui.document
    end)

    teardown(function()
        readerui:closeDocument()
        readerui:onClose()
    end)

    local cases = {
        {
            search = "nested",
            start_xpointer = "/body/DocFragment[1]/body/section/p[2]/text()[1].6",
            end_xpointer = "/body/DocFragment[1]/body/section/p[2]/em/text().6",
            text = "nested markup",
        },
        {
            search = "same",
            start_xpointer = "/body/DocFragment[1]/body/section/p[3]/text().7",
            end_xpointer = "/body/DocFragment[1]/body/section/p[3]/text().11",
            text = "same",
        },
        {
            search = "BC",
            start_xpointer = "/body/DocFragment[2]/body/section/p/text().2",
            end_xpointer = "/body/DocFragment[2]/body/section/p/text().4",
            text = "BC",
        },
    }

    for _, case in ipairs(cases) do
        it("resolves " .. case.text, function()
            local results = assert(document:findAllText(case.search, false, 0, 10, false))
            assert.is_true(#results > 0)
            print(
                "CRE_XPOINTER",
                case.search,
                results[1].start,
                results[1]["end"],
                results[1].matched_text
            )
            if os.getenv("SAKE_XPOINTER_DISCOVER") == "1" then
                return
            end
            assert.is_true(document:isXPointerInDocument(case.start_xpointer))
            assert.is_true(document:isXPointerInDocument(case.end_xpointer))
            assert.are.same(
                case.start_xpointer,
                document:getNormalizedXPointer(case.start_xpointer)
            )
            assert.are.same(
                case.text,
                document:getTextFromXPointers(case.start_xpointer, case.end_xpointer)
            )
        end)
    end

    it("loads the complete sidecar emitted by the web writer", function()
        local sidecar = dofile(assert(os.getenv("SAKE_READER_TEST_SIDECAR")))
        assert.are.same(0.5, sidecar.percent_finished)
        assert.are.same("reading", sidecar.summary.status)
        assert.are.same(0.5, sidecar.summary.percent_finished)
        assert.are.same("preserved", sidecar.unknown_fixture_setting)
        assert.are.same(20240114, sidecar.cre_dom_version)
        assert.are.same(1, #sidecar.annotations)
        assert.are.same(
            "/body/DocFragment[2]/body/section/p/text().2",
            sidecar.last_xpointer
        )
        assert.is_true(document:isXPointerInDocument(sidecar.last_xpointer))
        assert.are.same(
            sidecar.last_xpointer,
            document:getNormalizedXPointer(sidecar.last_xpointer)
        )

        local annotation = sidecar.annotations[1]
        assert.are.same("nested markup", annotation.text)
        assert.are.same("Interop note", annotation.note)
        assert.are.same("lighten", annotation.drawer)
        assert.are.same("yellow", annotation.color)
        assert.are.same(
            annotation.text,
            document:getTextFromXPointers(annotation.pos0, annotation.pos1)
        )
    end)
end)
