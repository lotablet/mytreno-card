# MyTreno Card

![version](https://img.shields.io/badge/version-1.0-blue)
![hacs](https://img.shields.io/badge/HACS-default-orange)
![license](https://img.shields.io/github/license/tuonome/lovelace-mytreno-card)

> Card Lovelace per visualizzare partenze e arrivi dei treni usando ViaggiaTreno.

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
