# Chat reliability consolidation map — October 23, 2026

The four replacement drafts share master `4e7582831e1aa71e03c50f28728e324a57ebaf7a`. Original branches and commits remain untouched. All 131 registered old drafts were confirmed open and draft before consolidation. No PR is merged or deployed.

Backend/database owns `backend/`, `supabase/migrations/` and the chat documentation. Web owns `frontend/apps/web/` and the shared `frontend/packages/api/src/endpoints/chat.ts` contract. iOS and Android own their existing native app directories. Clients depend on the backend’s additive topic/read/recovery protocol; validate the combined candidate before any release.

Preservation uses the effective changes at each final platform tip, not a replay of each stacked commit. All 130 implementation heads are ancestors of their corresponding tip. The only head outside those tips is #2747; its latest handoff at `926a044d42ece42ca00c437fa7962c0140b5d9be` is included in the backend draft. Earlier intentional fixes supersede their predecessors as recorded in the original history. Unrelated sessions, including #2802, are excluded.

Local archive refs pin each captured old PR head. Private snapshots, manifests, fixture state, raw failure logs and generated artifacts stay outside Git. The original complete PR register and failure history remain in the [handoff](chat-performance-handoff-2026-10-23.md).

| Destination | Replacement branch | Preserved implementation tip | Original PRs |
| --- | --- | --- | --- |
| Backend/database | `codex/chat-consolidated-backend` | `7239311c2` plus #2747 docs | 40 |
| Web | `codex/chat-consolidated-web` | `90d453f1d` | 33 |
| iOS | `codex/chat-consolidated-ios` | `3837b1f96` | 32 |
| Android | `codex/chat-consolidated-android` | `7c2dcb7d9` | 26 |

All 223 migration files match the backend candidate bytes. Every file present in running backend `ba1a00e3d` also matches byte-for-byte. `20261024002500` remains unapplied during consolidation; approved topic state and all earlier applied migrations remain immutable.

The new master baseline adds native URL-query redaction and its documentation; these upstream changes are retained and are not counted as chat implementation. No conflicts or authored test-code changes were needed.

## Old-to-new mapping

| Original PR | Preserved exact head | Destination | Preservation | Historical CI snapshot |
| --- | --- | --- | --- | --- |
| [#2665](https://github.com/WangPantopus/skinny-pantopus/pull/2665) | `68ce25ea74ed52eded4afda61f1c0ecba6e92ec8` | backend | Ancestor of candidate tip | Red |
| [#2666](https://github.com/WangPantopus/skinny-pantopus/pull/2666) | `7b917c164dfee80fd6bba1e804f7aa14eb4abbae` | backend | Ancestor of candidate tip | Red |
| [#2667](https://github.com/WangPantopus/skinny-pantopus/pull/2667) | `b30a2995d913831c5f9c7d0fc94b9598438ae2c1` | ios | Ancestor of candidate tip | Red |
| [#2668](https://github.com/WangPantopus/skinny-pantopus/pull/2668) | `c6378a091a29ca2ee68661940459beabafe0a75d` | android | Ancestor of candidate tip | No failure reported |
| [#2669](https://github.com/WangPantopus/skinny-pantopus/pull/2669) | `899307f41b081246dc3cd1b3e86241ba2eceb6c8` | web | Ancestor of candidate tip | No failure reported |
| [#2670](https://github.com/WangPantopus/skinny-pantopus/pull/2670) | `359e62a8e844250ac329aeaa1e547bb9bb3307d3` | backend | Ancestor of candidate tip | Red |
| [#2671](https://github.com/WangPantopus/skinny-pantopus/pull/2671) | `f8f4ac3443cab3f5ecf6fb7ee445ab70bf6b8fac` | web | Ancestor of candidate tip | No failure reported |
| [#2672](https://github.com/WangPantopus/skinny-pantopus/pull/2672) | `9f2cda8dcf4073cd44784c41e3932547ab32d4c0` | backend | Ancestor of candidate tip | Red |
| [#2673](https://github.com/WangPantopus/skinny-pantopus/pull/2673) | `4113905a838c2a606f7ccd804786599b5e527035` | backend | Ancestor of candidate tip | Red |
| [#2674](https://github.com/WangPantopus/skinny-pantopus/pull/2674) | `6522255907aafd205b513366c3cd4d1a6e3a85b0` | web | Ancestor of candidate tip | No failure reported |
| [#2675](https://github.com/WangPantopus/skinny-pantopus/pull/2675) | `b70be8997295c74bf9871714369f101a4bbaf5e8` | ios | Ancestor of candidate tip | Red |
| [#2676](https://github.com/WangPantopus/skinny-pantopus/pull/2676) | `9545b0cd001de55d371ea2049ca8a26e87d3b6d1` | backend | Ancestor of candidate tip | Red |
| [#2677](https://github.com/WangPantopus/skinny-pantopus/pull/2677) | `45ec1330bca691909015f3439ae4937237e17161` | backend | Ancestor of candidate tip | Red |
| [#2678](https://github.com/WangPantopus/skinny-pantopus/pull/2678) | `6a22765a39f615f612c8c4dc48fdca8027cd4505` | web | Ancestor of candidate tip | Red |
| [#2679](https://github.com/WangPantopus/skinny-pantopus/pull/2679) | `d15414c443d528866955720241c3e3e889f0d383` | backend | Ancestor of candidate tip | Red |
| [#2680](https://github.com/WangPantopus/skinny-pantopus/pull/2680) | `5ac4870a66976c0f78c439b6f64bdbfa9f2b09f8` | backend | Ancestor of candidate tip | Red |
| [#2681](https://github.com/WangPantopus/skinny-pantopus/pull/2681) | `dbaf96578d30c2f1a9cec1c9d3851b996d85b344` | android | Ancestor of candidate tip | Red |
| [#2682](https://github.com/WangPantopus/skinny-pantopus/pull/2682) | `bb117ca31baf5b57c4a743f69ad199a5ad84349d` | web | Ancestor of candidate tip | Red |
| [#2683](https://github.com/WangPantopus/skinny-pantopus/pull/2683) | `cad45f6309b29fc7954963657d3cbeed82518ff4` | backend | Ancestor of candidate tip | Red |
| [#2684](https://github.com/WangPantopus/skinny-pantopus/pull/2684) | `3ebd17a001b089f663f55643389d761acef5dcf9` | web | Ancestor of candidate tip | Red |
| [#2685](https://github.com/WangPantopus/skinny-pantopus/pull/2685) | `031208a910ddb1350ecf8fe0bc51c77cab9c5170` | web | Ancestor of candidate tip | Red |
| [#2686](https://github.com/WangPantopus/skinny-pantopus/pull/2686) | `0c12aff4ffaea900803f80a77d48cf3f9f855096` | android | Ancestor of candidate tip | Red |
| [#2687](https://github.com/WangPantopus/skinny-pantopus/pull/2687) | `f7b996bd8f7e9a6982a6842cd756913225b9906c` | backend | Ancestor of candidate tip | Red |
| [#2688](https://github.com/WangPantopus/skinny-pantopus/pull/2688) | `70c3a252151d769fb88471b032d261d24204925c` | web | Ancestor of candidate tip | Red |
| [#2689](https://github.com/WangPantopus/skinny-pantopus/pull/2689) | `87fd7bc2fff4ff2bcc94051b2378ee4bcd8449d7` | backend | Ancestor of candidate tip | Red |
| [#2690](https://github.com/WangPantopus/skinny-pantopus/pull/2690) | `e2fe0b460291280194be9f7aecfa5678279d19c4` | backend | Ancestor of candidate tip | Red |
| [#2691](https://github.com/WangPantopus/skinny-pantopus/pull/2691) | `045f6a992d147f8f31185720a8d3e73e993ce682` | android | Ancestor of candidate tip | Red |
| [#2692](https://github.com/WangPantopus/skinny-pantopus/pull/2692) | `11ea75ae98ddfc5f1276586ec5df4379987d1a2e` | web | Ancestor of candidate tip | Red |
| [#2693](https://github.com/WangPantopus/skinny-pantopus/pull/2693) | `ea7d1177a9b9cfebc09420003bd7bac607c772e1` | ios | Ancestor of candidate tip | Red |
| [#2694](https://github.com/WangPantopus/skinny-pantopus/pull/2694) | `aa4e7222b6215be70f23d89eea9861e6926c5e3e` | web | Ancestor of candidate tip | Red |
| [#2695](https://github.com/WangPantopus/skinny-pantopus/pull/2695) | `63ff8dca2c6b529f431e902d1ed60c98b172dbc4` | backend | Ancestor of candidate tip | Red |
| [#2696](https://github.com/WangPantopus/skinny-pantopus/pull/2696) | `2f81e2f3a770d054ceac63a0f3bdc24a03e9b693` | android | Ancestor of candidate tip | Red |
| [#2697](https://github.com/WangPantopus/skinny-pantopus/pull/2697) | `7d3bba85bde7ec82affccefde71d31d9d532780c` | web | Ancestor of candidate tip | Red |
| [#2698](https://github.com/WangPantopus/skinny-pantopus/pull/2698) | `b812789d85724103f69ffcca265da535347dd69e` | backend | Ancestor of candidate tip | Red |
| [#2699](https://github.com/WangPantopus/skinny-pantopus/pull/2699) | `3ae0768bd0ec204e88d1fa0f11350f06cdbe4c2a` | backend | Ancestor of candidate tip | Red |
| [#2700](https://github.com/WangPantopus/skinny-pantopus/pull/2700) | `66c94ad0e71afb28715c0bfa38f0a6dfb238d040` | android | Ancestor of candidate tip | Red |
| [#2701](https://github.com/WangPantopus/skinny-pantopus/pull/2701) | `a56d8cc8f445e77c27c4e0417a6cf2ccc16ce3fa` | backend | Ancestor of candidate tip | Red |
| [#2702](https://github.com/WangPantopus/skinny-pantopus/pull/2702) | `b05536bf2578e9217d0cfbe57414a050256c5af6` | web | Ancestor of candidate tip | Red |
| [#2703](https://github.com/WangPantopus/skinny-pantopus/pull/2703) | `5b83229b8de9d597e977dc511fa0fac41be46df6` | android | Ancestor of candidate tip | Red |
| [#2704](https://github.com/WangPantopus/skinny-pantopus/pull/2704) | `d209698c79d86e19e6caf5b05c1f162eca50f4bf` | android | Ancestor of candidate tip | Red |
| [#2705](https://github.com/WangPantopus/skinny-pantopus/pull/2705) | `c3d9dc90c87079ac012a099b0e7aec6064cd8ae2` | backend | Ancestor of candidate tip | Red |
| [#2706](https://github.com/WangPantopus/skinny-pantopus/pull/2706) | `63378f186b578a31a08d6bfbd0928e2ee5b88b70` | backend | Ancestor of candidate tip | Red |
| [#2707](https://github.com/WangPantopus/skinny-pantopus/pull/2707) | `37f286575eb7c87115b5d18152eca685f2a5325e` | web | Ancestor of candidate tip | Red |
| [#2708](https://github.com/WangPantopus/skinny-pantopus/pull/2708) | `d2a86ab2eb5288c30b1609cb640e5fb5f5fa50bb` | web | Ancestor of candidate tip | Red |
| [#2709](https://github.com/WangPantopus/skinny-pantopus/pull/2709) | `2077e39fd86445f995e4ca853f59e92eb1930c2f` | ios | Ancestor of candidate tip | Red |
| [#2710](https://github.com/WangPantopus/skinny-pantopus/pull/2710) | `fc88a6058aadbc7d395dde7abc9bbfb72190cbe3` | ios | Ancestor of candidate tip | Red |
| [#2711](https://github.com/WangPantopus/skinny-pantopus/pull/2711) | `bee7190a3a2076100eed1835ca6e34fe0febb7ea` | android | Ancestor of candidate tip | Red |
| [#2712](https://github.com/WangPantopus/skinny-pantopus/pull/2712) | `d8be1ea7db34a3824d74bf5bc3db8bf9eb859424` | backend | Ancestor of candidate tip | Red |
| [#2713](https://github.com/WangPantopus/skinny-pantopus/pull/2713) | `206530f2cb8fbb7c44c92dcb3e391063b36274cb` | android | Ancestor of candidate tip | Red |
| [#2714](https://github.com/WangPantopus/skinny-pantopus/pull/2714) | `61fdfbabf77353eb00595df3d84294eacfbd2f0d` | ios | Ancestor of candidate tip | Red |
| [#2715](https://github.com/WangPantopus/skinny-pantopus/pull/2715) | `e5a91ced24b131e91b265eab09ffc9d35b40a68a` | android | Ancestor of candidate tip | Red |
| [#2716](https://github.com/WangPantopus/skinny-pantopus/pull/2716) | `806a45c35e203613c6779596f928d053c5de2bfb` | android | Ancestor of candidate tip | Red |
| [#2717](https://github.com/WangPantopus/skinny-pantopus/pull/2717) | `cbd4ff79732903b07516c7426c73824f6f24b762` | backend | Ancestor of candidate tip | Red |
| [#2718](https://github.com/WangPantopus/skinny-pantopus/pull/2718) | `a64ce681ef92410fa70d45908f196353cdf93b3b` | backend | Ancestor of candidate tip | No failure reported |
| [#2719](https://github.com/WangPantopus/skinny-pantopus/pull/2719) | `fa7570d07c675c65866e1c6d8181c5bf33412ff8` | web | Ancestor of candidate tip | Red |
| [#2720](https://github.com/WangPantopus/skinny-pantopus/pull/2720) | `795f9ada699c4cc145d7f30f6aa0263d59c9859c` | ios | Ancestor of candidate tip | Red |
| [#2721](https://github.com/WangPantopus/skinny-pantopus/pull/2721) | `1bd0f282b91f13ef7954896fb850e861daf8d59b` | backend | Ancestor of candidate tip | Red |
| [#2722](https://github.com/WangPantopus/skinny-pantopus/pull/2722) | `3603029259dfec92a0d70bfc17f57d7e378e24ad` | backend | Ancestor of candidate tip | Red |
| [#2723](https://github.com/WangPantopus/skinny-pantopus/pull/2723) | `586caddba117b24a902f284b15029176e2aca9aa` | web | Ancestor of candidate tip | Red |
| [#2724](https://github.com/WangPantopus/skinny-pantopus/pull/2724) | `9221185efc93b90dbdbaef4e1e2bbce790c33c23` | ios | Ancestor of candidate tip | Red |
| [#2725](https://github.com/WangPantopus/skinny-pantopus/pull/2725) | `04561fef62c4726730f5069a190fa9711d1dd038` | backend | Ancestor of candidate tip | Red |
| [#2726](https://github.com/WangPantopus/skinny-pantopus/pull/2726) | `acc62f25b7e4a282f0f6296ea6d28040d8ec9a2c` | web | Ancestor of candidate tip | Red |
| [#2727](https://github.com/WangPantopus/skinny-pantopus/pull/2727) | `10499de4d03d5a32c4f7f3717effaea44a7bcd86` | backend | Ancestor of candidate tip | Red |
| [#2728](https://github.com/WangPantopus/skinny-pantopus/pull/2728) | `96e30c481fe5d3143c8d9386d9ffe35544a73161` | ios | Ancestor of candidate tip | Red |
| [#2729](https://github.com/WangPantopus/skinny-pantopus/pull/2729) | `3450b928ca588930e48b55af2a11da0a5efabdfc` | backend | Ancestor of candidate tip | Red + running |
| [#2730](https://github.com/WangPantopus/skinny-pantopus/pull/2730) | `bcc86e65d69a174225df038a651cf6a438d22845` | backend | Ancestor of candidate tip | Red + running |
| [#2731](https://github.com/WangPantopus/skinny-pantopus/pull/2731) | `d0c14af5772367f2dc449e4999c69eefcfa80e5a` | android | Ancestor of candidate tip | Red |
| [#2732](https://github.com/WangPantopus/skinny-pantopus/pull/2732) | `9cb0b88a186da4da92a440ecbed5a899dde7a9ee` | android | Ancestor of candidate tip | Red |
| [#2733](https://github.com/WangPantopus/skinny-pantopus/pull/2733) | `2ea81117756e6f7bd2129e3739d6cfab157c7bfb` | web | Ancestor of candidate tip | Red |
| [#2735](https://github.com/WangPantopus/skinny-pantopus/pull/2735) | `77b6a372631d0e6b3a2e385cd87f25e87b824870` | backend | Ancestor of candidate tip | Red + running |
| [#2736](https://github.com/WangPantopus/skinny-pantopus/pull/2736) | `1d7d76971089a793f35c5bf2d6f005a5df819ea0` | android | Ancestor of candidate tip | Red |
| [#2737](https://github.com/WangPantopus/skinny-pantopus/pull/2737) | `e3fdd7d1d157241f47f2724cfb798612d9ee1d55` | android | Ancestor of candidate tip | Red |
| [#2738](https://github.com/WangPantopus/skinny-pantopus/pull/2738) | `b5d780d0576d6fe2eb7c42aed1932138019835be` | backend | Ancestor of candidate tip | Red + running |
| [#2739](https://github.com/WangPantopus/skinny-pantopus/pull/2739) | `4c4d50e4b6c416bbbe73f39672528d1207a1f263` | web | Ancestor of candidate tip | Red |
| [#2740](https://github.com/WangPantopus/skinny-pantopus/pull/2740) | `d080afd82ab0ac185e465985fa1edbf472903a74` | backend | Ancestor of candidate tip | Red + running |
| [#2741](https://github.com/WangPantopus/skinny-pantopus/pull/2741) | `ae993decf39ba8860f02369c9246f962e1883753` | web | Ancestor of candidate tip | Red |
| [#2742](https://github.com/WangPantopus/skinny-pantopus/pull/2742) | `f30d525142f2465ff6f7eefddb07486edc2cef4c` | ios | Ancestor of candidate tip | Red |
| [#2743](https://github.com/WangPantopus/skinny-pantopus/pull/2743) | `af9e5d6a867e0d0995a87f6c15e2c977076d3151` | ios | Ancestor of candidate tip | Red |
| [#2744](https://github.com/WangPantopus/skinny-pantopus/pull/2744) | `a5efe49c1348a841db403633218bde0b8e8d5982` | backend | Ancestor of candidate tip | Red + running |
| [#2745](https://github.com/WangPantopus/skinny-pantopus/pull/2745) | `228b6d393e8e9fcd12d21d2e11490b88bc9edfda` | android | Ancestor of candidate tip | Red |
| [#2746](https://github.com/WangPantopus/skinny-pantopus/pull/2746) | `d26d57c5e01d3f9d1344427fe9ca394dcf3f9d34` | web | Ancestor of candidate tip | Red |
| [#2747](https://github.com/WangPantopus/skinny-pantopus/pull/2747) | `926a044d42ece42ca00c437fa7962c0140b5d9be` | backend | Latest handoff copied unchanged | No failure reported |
| [#2748](https://github.com/WangPantopus/skinny-pantopus/pull/2748) | `26ea5d864959c10c525797a068333fddce49b2e2` | ios | Ancestor of candidate tip | Red |
| [#2749](https://github.com/WangPantopus/skinny-pantopus/pull/2749) | `411d64bc593a55012b9b03664a3ec7fed1b839d8` | ios | Ancestor of candidate tip | Red |
| [#2750](https://github.com/WangPantopus/skinny-pantopus/pull/2750) | `96fe3a077a44a7e06039b819f887eed5d74e6bfd` | android | Ancestor of candidate tip | Red |
| [#2751](https://github.com/WangPantopus/skinny-pantopus/pull/2751) | `38aae7fbe21fd256169abbd1f6ebc435f1d65a35` | ios | Ancestor of candidate tip | Red |
| [#2752](https://github.com/WangPantopus/skinny-pantopus/pull/2752) | `6452b4abe90ef3d7557ae41d7a26b2a0429aff8e` | ios | Ancestor of candidate tip | Red |
| [#2753](https://github.com/WangPantopus/skinny-pantopus/pull/2753) | `3357edcad2a3746a7d348e4d947ebf99974fe062` | ios | Ancestor of candidate tip | Red |
| [#2754](https://github.com/WangPantopus/skinny-pantopus/pull/2754) | `d185f2e4f7eabc700d9835b44c85e687f6ce3eb8` | ios | Ancestor of candidate tip | Red |
| [#2755](https://github.com/WangPantopus/skinny-pantopus/pull/2755) | `ce782760d2e1c99071c4a913933e46268daf1cba` | android | Ancestor of candidate tip | Red |
| [#2757](https://github.com/WangPantopus/skinny-pantopus/pull/2757) | `21f52cb56320f4646d984155471cdb457e05a3ae` | web | Ancestor of candidate tip | Red |
| [#2758](https://github.com/WangPantopus/skinny-pantopus/pull/2758) | `9cf832b6431c74e0b44cf93e97d350686f343b89` | backend | Ancestor of candidate tip | Red + running |
| [#2759](https://github.com/WangPantopus/skinny-pantopus/pull/2759) | `e9e39afd4cc028e49acccd2b326361b3ce10277b` | android | Ancestor of candidate tip | Red |
| [#2760](https://github.com/WangPantopus/skinny-pantopus/pull/2760) | `c3e42208f57314e8f7174cf0ac26d926878c06c8` | ios | Ancestor of candidate tip | Red |
| [#2762](https://github.com/WangPantopus/skinny-pantopus/pull/2762) | `a542ab8db4f3de2296f39c7273b5cca6c79becbf` | backend | Ancestor of candidate tip | Red + running |
| [#2763](https://github.com/WangPantopus/skinny-pantopus/pull/2763) | `0f98a177eb942a7cc55176e8c814357b075e4ea7` | web | Ancestor of candidate tip | Red |
| [#2764](https://github.com/WangPantopus/skinny-pantopus/pull/2764) | `d2554a0a7993abeb6564181516425efcab3ebcbc` | web | Ancestor of candidate tip | Red |
| [#2765](https://github.com/WangPantopus/skinny-pantopus/pull/2765) | `b900547c6de2526248116b2c6f4b08c5a9a3ed0f` | web | Ancestor of candidate tip | Red |
| [#2766](https://github.com/WangPantopus/skinny-pantopus/pull/2766) | `460de982c8db21922095dffd77dd584e07cc2232` | android | Ancestor of candidate tip | Red |
| [#2768](https://github.com/WangPantopus/skinny-pantopus/pull/2768) | `8e4fe7ad0869380bd41493838be1ae6dba12d0cb` | android | Ancestor of candidate tip | Red |
| [#2769](https://github.com/WangPantopus/skinny-pantopus/pull/2769) | `f25522709a45f545fc64eb0f42fcb694e92a0afc` | ios | Ancestor of candidate tip | Red |
| [#2770](https://github.com/WangPantopus/skinny-pantopus/pull/2770) | `7cc500012e32a066436da0762dec2879e22bbb5f` | ios | Ancestor of candidate tip | Red |
| [#2771](https://github.com/WangPantopus/skinny-pantopus/pull/2771) | `db58024a3ec88d9c96f02ae3e8325329786447a2` | ios | Ancestor of candidate tip | Red |
| [#2772](https://github.com/WangPantopus/skinny-pantopus/pull/2772) | `51cddb638316615f4dd5c910f1f79167831261f7` | ios | Ancestor of candidate tip | Red |
| [#2773](https://github.com/WangPantopus/skinny-pantopus/pull/2773) | `b59767d2c966bd8600a1ff53c74e35945a2196a4` | backend | Ancestor of candidate tip | Red + running |
| [#2774](https://github.com/WangPantopus/skinny-pantopus/pull/2774) | `4a688552fcf23dea8d961463bb6c2a1a1854ce12` | web | Ancestor of candidate tip | Red |
| [#2775](https://github.com/WangPantopus/skinny-pantopus/pull/2775) | `56aba3e023a0c6aec4d41edc273fad3d36bae464` | android | Ancestor of candidate tip | Red |
| [#2776](https://github.com/WangPantopus/skinny-pantopus/pull/2776) | `bb96ad896813f88a4ed06c71864d536ee7abcbf8` | ios | Ancestor of candidate tip | Red |
| [#2777](https://github.com/WangPantopus/skinny-pantopus/pull/2777) | `cdfb189ab0427a4133f65a57e7d6bafe325f3059` | backend | Ancestor of candidate tip | Red + running |
| [#2779](https://github.com/WangPantopus/skinny-pantopus/pull/2779) | `79a9d848a3a22c2bf9bde521872f213205d62a10` | ios | Ancestor of candidate tip | Red |
| [#2780](https://github.com/WangPantopus/skinny-pantopus/pull/2780) | `d561bb25eee8fa46aa431a2ec59f451cd934edf1` | web | Ancestor of candidate tip | Red |
| [#2781](https://github.com/WangPantopus/skinny-pantopus/pull/2781) | `00e5d40e3c6205405d8817b3fa5b60cc3a406787` | ios | Ancestor of candidate tip | Red |
| [#2782](https://github.com/WangPantopus/skinny-pantopus/pull/2782) | `299f5e2330c643d3dc21136e5013749673d3ce29` | ios | Ancestor of candidate tip | Red |
| [#2783](https://github.com/WangPantopus/skinny-pantopus/pull/2783) | `5504566cdb5102056e18f61b5e9bce7fa239263d` | android | Ancestor of candidate tip | Red |
| [#2784](https://github.com/WangPantopus/skinny-pantopus/pull/2784) | `e93d1b61fc08aa3313047748d92366a887424990` | web | Ancestor of candidate tip | Red |
| [#2785](https://github.com/WangPantopus/skinny-pantopus/pull/2785) | `b43fa35989f079b5190135aea6904acb34087f4b` | android | Ancestor of candidate tip | Red |
| [#2786](https://github.com/WangPantopus/skinny-pantopus/pull/2786) | `c3cf94647c022954fa61ad95b5d3685c760fb9db` | ios | Ancestor of candidate tip | Running |
| [#2787](https://github.com/WangPantopus/skinny-pantopus/pull/2787) | `0de454155b5ff144f7771ab8517914fcad0b8405` | backend | Ancestor of candidate tip | Red |
| [#2788](https://github.com/WangPantopus/skinny-pantopus/pull/2788) | `a38026ce17d09675e71b2730ccf0c498f9eb2953` | web | Ancestor of candidate tip | Red |
| [#2789](https://github.com/WangPantopus/skinny-pantopus/pull/2789) | `7c2dcb7d9c2dfca3cedd40c83a31427a2c8f3527` | android | Ancestor of candidate tip | Red + running |
| [#2790](https://github.com/WangPantopus/skinny-pantopus/pull/2790) | `ba1a00e3dc1196d462a8306c81ae724d681db0e5` | backend | Ancestor of candidate tip | Red + running |
| [#2791](https://github.com/WangPantopus/skinny-pantopus/pull/2791) | `8391341fc331226084d2d652445c85cc98afc8e1` | ios | Ancestor of candidate tip | Running |
| [#2792](https://github.com/WangPantopus/skinny-pantopus/pull/2792) | `daf7a7e25bf4d8b78ec17a74f070e57d976b700e` | web | Ancestor of candidate tip | Red |
| [#2793](https://github.com/WangPantopus/skinny-pantopus/pull/2793) | `e406daca8eb3386eaf377f3116299a41626fa35c` | web | Ancestor of candidate tip | Red |
| [#2794](https://github.com/WangPantopus/skinny-pantopus/pull/2794) | `8956664c0c287a36a872c5aaa02900e9677696c3` | ios | Ancestor of candidate tip | Running |
| [#2796](https://github.com/WangPantopus/skinny-pantopus/pull/2796) | `5fc6371398fe65c1ee087dd716539178fcfe71f0` | web | Ancestor of candidate tip | Red |
| [#2797](https://github.com/WangPantopus/skinny-pantopus/pull/2797) | `68c28abdd9ee9db7ba0f39d66593dcca612ed842` | ios | Ancestor of candidate tip | Running |
| [#2798](https://github.com/WangPantopus/skinny-pantopus/pull/2798) | `045fc9d2046dc8739f6d704e7111785e1870709d` | ios | Ancestor of candidate tip | Running |
| [#2799](https://github.com/WangPantopus/skinny-pantopus/pull/2799) | `3837b1f961b0976513489457cda5106d93fa2204` | ios | Ancestor of candidate tip | Running |
| [#2800](https://github.com/WangPantopus/skinny-pantopus/pull/2800) | `90d453f1d94a7170dba3b2f57f4669a4ca07d437` | web | Ancestor of candidate tip | Red + running |
| [#2801](https://github.com/WangPantopus/skinny-pantopus/pull/2801) | `7239311c2e61362ea1c4036a1cb9c674feb06054` | backend | Ancestor of candidate tip | Red |
