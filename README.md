# SPAYD QR dekodér

Standalone webová aplikace pro dekódování českých platebních QR kódů ve formátu **SPAYD** (Short Payment Descriptor). Vše běží lokálně v prohlížeči — žádný backend, žádné odesílání dat.

## Funkce

- Skenování QR kódu **živou kamerou** (zadní fotoaparát na mobilu)
- Načtení QR kódu z **nahraného obrázku** (klik nebo drag & drop)
- Parser SPAYD řetězce (formát `SPD*1.0*ACC:…*AM:…*…`)
- Zobrazení všech běžných polí:
  - IBAN + odvozené **české číslo účtu** (např. `1234567899/0800`)
  - BIC / SWIFT
  - Částka a měna
  - Variabilní, specifický a konstantní symbol
  - Zpráva pro příjemce, jméno příjemce
  - Datum splatnosti, typ platby, reference plátce
  - Rozšířená pole (`X-ID`, `X-URL`, `X-PER`, …)
- **Tlačítka Kopírovat** u každého pole zvlášť
- Tmavý režim podle systému

## Spuštění

Aplikace je čistě statická. Stačí otevřít `index.html`, ale **přístup ke kameře** vyžaduje `https://` nebo `localhost`. Lokálně tedy nejjednodušeji:

```bash
python3 -m http.server 8000
# nebo
npx serve .
```

Pak otevři `http://localhost:8000`.

## Závislosti

Pouze [jsQR](https://github.com/cozmo/jsQR) přes CDN (jsdelivr). Žádný build, žádné `node_modules`.

## Struktura

```
spayd-decoder/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Formát SPAYD

Specifikace: <https://qr-platba.cz/pro-vyvojare/specifikace-formatu/>

Příklad: `SPD*1.0*ACC:CZ5808000000001234567899*AM:480.55*CC:CZK*MSG:Platba*X-VS:1234567890`
