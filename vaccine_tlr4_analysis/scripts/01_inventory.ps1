# =====================================================================
# 01_inventory.ps1  --  ETAPE 1b : inventaire du fichier PDB
# ---------------------------------------------------------------------
# Version PowerShell de l'inventaire, qui ne demande AUCUN logiciel
# installe. Utile pour repondre immediatement aux questions :
#   - combien de chaines ?
#   - quels numeros de residus ?
#   - y a-t-il des molecules non proteiques (MD-2, lipides, ions, eau) ?
#   - y a-t-il des hydrogenes ?
#
# Le script equivalent pour PyMOL est 01_inventory.pml (plus complet :
# il detecte en plus les ruptures de chaine par distance CA-CA).
#
# UTILISATION, depuis le dossier vaccine_tlr4_analysis :
#   powershell -ExecutionPolicy Bypass -File scripts\01_inventory.ps1 > results\logs\01_inventory.txt
#
# Ce script est en LECTURE SEULE : il ne modifie jamais la structure.
# =====================================================================

$pdb = "structures\complex.pdb"

if (-not (Test-Path $pdb)) {
    Write-Host "ERREUR : $pdb introuvable. Lance ce script depuis le dossier vaccine_tlr4_analysis."
    exit 1
}

$lines = Get-Content $pdb

# ---------------------------------------------------------------------
Write-Host ("=" * 74)
Write-Host "1. RESUME DU FICHIER"
Write-Host ("=" * 74)
Write-Host "  fichier          : $pdb"
Write-Host "  lignes totales   : $($lines.Count)"

$models = ($lines | Where-Object { $_ -like 'MODEL*' }).Count
Write-Host "  enregistrements MODEL (frames) : $models"
Write-Host ""
Write-Host "  Types d'enregistrements presents :"
$lines | ForEach-Object { ($_ -split '\s+')[0] } |
    Group-Object -NoElement | Sort-Object Count -Descending |
    Format-Table Count, Name -AutoSize | Out-String | Write-Host

# ---------------------------------------------------------------------
# Extraction des colonnes selon le format PDB officiel (indices 0-based) :
#   17-19 = nom du residu, 21 = chaine, 22-25 = numero de residu,
#   12-15 = nom de l'atome, 76-77 = element
$atoms = $lines | Where-Object {
    ($_ -like 'ATOM*' -or $_ -like 'HETATM*') -and $_.Length -ge 26
}

$rec = $atoms | ForEach-Object {
    [PSCustomObject]@{
        Ch   = $_.Substring(21,1)
        RN   = $_.Substring(17,3).Trim()
        RS   = [int]($_.Substring(22,4).Trim())
        Nom  = $_.Substring(12,4).Trim()
        Elem = if ($_.Length -ge 78) { $_.Substring(76,2).Trim() } else { "" }
    }
}

Write-Host ("=" * 74)
Write-Host "2. INVENTAIRE PAR CHAINE"
Write-Host ("=" * 74)

$rec | Group-Object Ch | ForEach-Object {
    $nums = $_.Group.RS | Sort-Object -Unique
    $trous = 0
    for ($i = 1; $i -lt $nums.Count; $i++) {
        if ($nums[$i] -ne $nums[$i-1] + 1) { $trous++ }
    }
    [PSCustomObject]@{
        Chaine   = if ($_.Name.Trim()) { $_.Name } else { '(vide)' }
        Atomes   = $_.Count
        Residus  = $nums.Count
        Premier  = ($_.Group.RS | Measure-Object -Minimum).Minimum
        Dernier  = ($_.Group.RS | Measure-Object -Maximum).Maximum
        Trous    = $trous
    }
} | Sort-Object Chaine | Format-Table -AutoSize | Out-String | Write-Host

# ---------------------------------------------------------------------
Write-Host ("=" * 74)
Write-Host "3. RESIDUS NON STANDARDS (ni acide amine classique)"
Write-Host ("=" * 74)

$aa = 'ALA','ARG','ASN','ASP','CYS','GLN','GLU','GLY','HIS','ILE','LEU',
      'LYS','MET','PHE','PRO','SER','THR','TRP','TYR','VAL'

$odd = $rec | Where-Object { $aa -notcontains $_.RN }
if ($odd.Count -eq 0) {
    Write-Host "  aucun : tous les residus sont des acides amines standards"
} else {
    $odd | Group-Object Ch, RN -NoElement | Sort-Object Name |
        Format-Table Count, Name -AutoSize | Out-String | Write-Host
}

# ---------------------------------------------------------------------
Write-Host ("=" * 74)
Write-Host "4. HYDROGENES"
Write-Host ("=" * 74)

$hElem = ($rec | Where-Object { $_.Elem -eq 'H' }).Count
$hNom  = ($rec | Where-Object { $_.Nom -match '^[0-9]?H' }).Count
Write-Host "  atomes dont la colonne element vaut H : $hElem"
Write-Host "  atomes dont le nom commence par H     : $hNom"
Write-Host ""
if ($hElem -eq 0 -and $hNom -eq 0) {
    Write-Host "  -> AUCUN hydrogene. La structure ne contient que les atomes lourds."
    Write-Host "     C'est typique d'une sortie de docking (ClusPro, HADDOCK, PatchDock)."
    Write-Host "     Consequence : les liaisons hydrogene devront etre deduites de la"
    Write-Host "     geometrie des atomes lourds, ou apres ajout d'hydrogenes predits."
} else {
    Write-Host "  -> Hydrogenes presents : typique d'une structure issue de MD ou"
    Write-Host "     d'un outil de protonation."
}
Write-Host ""
Write-Host ("=" * 74)
Write-Host "FIN DE L'INVENTAIRE"
Write-Host ("=" * 74)
