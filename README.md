# MyTreno Card

![version](https://img.shields.io/badge/version-2.0.1-blue)
![hacs](https://img.shields.io/badge/HACS-default-orange)

> Card Lovelace per visualizzare partenze e arrivi dei treni usando ViaggiaTreno.
---
<p align="center">
  <img src="https://github.com/lotablet/mytreno-card/blob/main/image/sample_card.gif" alt="sample_card" />
</p>

## 📦 Installazione via HACS

1. Vai in HACS → Frontend → Menu (⋮) → "Custom repositories"
2. Inserisci l'URL della repo e imposta tipo: `Lovelace`:

```
https://github.com/lotablet/mytreno-card/
```


3. Installa `MyTreno Card`
4. Dopo il riavvio, aggiungi questa card in Lovelace:

```
type: custom:my-treno-card
sensor: sensor.mytreno_laspezia
```
Puoi anche usare card mod per "aggiustare" le dimensioni della card

```
type: custom:my-treno-card
sensor: sensor.mytreno_la_spezia_centrale
card_mod:
  style: |
    ha-card {
      height: 400px;
      width: 450px;
    }
```
