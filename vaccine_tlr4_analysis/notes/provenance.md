# Provenance des fichiers d'entrée

## Structure analysée

| Champ | Valeur |
|---|---|
| Nom d'origine | `V1hantaTLR4G8A.pdb` |
| Chemin source | `C:\Users\outhmane\Desktop\vaccin contre andes\complexe vaccin 4G8A\V1hantaTLR4G8A.pdb` |
| Taille | 810 315 octets |
| MD5 | `BBCC99205DDBBD066846B8DA1BB124E9` |
| Copié vers | `structures/complex.pdb` et `structures/complex_original.pdb` |
| Date de copie | 2026-08-15 |
| Vérification | Les 3 empreintes MD5 (source + 2 copies) sont identiques |

## Contexte

- Vaccin : construction **V1** contre l'hantavirus (Andes / Hantaan)
- Séquence du vaccin : `Desktop\vaccin contre andes\Vaccin-1Hanta.fasta` (502 octets)
- Récepteur : TLR4, basé sur l'entrée PDB **4G8A** (à confirmer par la séquence, non supposé)
- Constructions parallèles disponibles : `V2hantaTLR4G8A.pdb`, `V3hantaTLR4G8A.pdb`
  → le même pipeline devra tourner à l'identique sur les trois.

## À documenter (obligatoire pour la section Méthodes)

- [ ] Origine exacte du complexe : docking seul, ou docking + dynamique moléculaire ?
- [ ] Si MD : quelle trajectoire, quelle frame, et **comment** cette frame a été choisie
      (structure représentative du cluster le plus peuplé / frame moyenne / dernière frame)
- [ ] Logiciel de docking utilisé et version
- [ ] Champ de force et durée de simulation, le cas échéant

## Journal

| Date | Étape | Résultat |
|---|---|---|
| 2026-08-15 | 1a — copie et vérification du fichier | ✅ MD5 identiques |
| | 1b — inventaire structural | en cours |
