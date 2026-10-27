<?php

namespace IFM\Tests\Integration;

use IFM\Tests\Support\IfmServerTestCase;

/**
 * The standalone page must embed the compiled Vue frontend and boot it.
 */
class FrontendTest extends IfmServerTestCase
{
    public function testPageEmbedsAndBootsTheFrontend(): void
    {
        $this->startServer();
        $resp = $this->client()->get('/index.php');
        $html = $resp->getBody()->getContents();

        $this->assertSame(200, $resp->getStatusCode());
        // str_contains keeps failure output short (the page is ~1 MB)
        $expected = [
            '<div id="ifm"></div>',
            // the bundle registers the IFM constructor and the page mounts it
            'window.IFM=',
            'var ifm = new IFM(); ifm.init("ifm");',
            // bundled assets: the Ace editor and the frontend stylesheet
            'define("ace/',
            '#filedropoverlay',
            // the version placeholder is replaced at compile time
            'releases/tag/',
        ];
        foreach ($expected as $needle)
            $this->assertTrue(str_contains($html, $needle), "page must contain: $needle");
        $this->assertFalse(str_contains($html, 'IFM_VERSION'), 'version placeholder must be replaced');
    }

    public function testTemplatesAreNoLongerServedByTheBackend(): void
    {
        $this->startServer();
        $this->assertErrorStatus($this->apiGet('getTemplates'));
    }

    public function testConfigListsTheCompiledAceFiles(): void
    {
        $this->startServer();
        $cfg = $this->apiGet('getConfig');
        $this->assertArrayHasKey('ace_includes', $cfg);
        $this->assertIsString($cfg['ace_includes']);
        $this->assertStringNotContainsString('###', $cfg['ace_includes']);
    }
}
