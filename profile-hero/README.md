# Profile hero banner

Pure-SVG (SMIL animations, no JS) GitHub profile README hero for Germán Cárdenas. Two theme variants, same layout.

Embed in a profile README with automatic theme switching:

```md
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/licgermancardenas-crypto/LAPD-DATA-CRIME/main/profile-hero/dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/licgermancardenas-crypto/LAPD-DATA-CRIME/main/profile-hero/light.svg">
  <img src="https://raw.githubusercontent.com/licgermancardenas-crypto/LAPD-DATA-CRIME/main/profile-hero/light.svg" alt="Germán Cárdenas">
</picture>
```

The Atlas Analytics logo is embedded as base64 PNG (`profile-hero/atlas_logo_source.png` keeps the untouched source at full resolution). Edit name/role/contact/skills text directly inside the `<text>` elements of `dark.svg` and mirror the change in `light.svg`.
