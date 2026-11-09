import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDevelopmentConnectionsLink as render} from '../src/dev-cloud-shell.mjs';
import {allowedPublicPath} from '../tools/local-server.mjs';
test('local connection entry appears only on local HTTP app pages',()=>{
 for(const url of ['http://localhost:5215/dev-account.html','http://127.0.0.1:5301/dev-integration.html','http://[::1]:5301/'])assert.match(render(url),/href="http:\/\/127\.0\.0\.1:5301\/auth\/google\/"/);
 for(const url of ['https://example.com/','http://example.com/','http://localhost.evil.test/','http://user:password@localhost/','invalid'])assert.equal(render(url),'');

});
