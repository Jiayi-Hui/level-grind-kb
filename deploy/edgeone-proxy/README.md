# Level Grind EdgeOne proxy

This small EdgeOne Makers project proxies all requests to
`https://origin.level-grind.com`.

It exists so the current Sites deployment, including its dynamic APIs and
storage bindings, can remain unchanged while a Tencent edge hostname is tested
from mainland China.

The intended public hostname is `demo.level-grind.com`. The production apex
`level-grind.com` must not be changed until the proxy has passed login, asset,
API, and mainland-network tests.
