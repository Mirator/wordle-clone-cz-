# Wordle CZ (bez build kroků)

Plnohodnotná verze Wordle pro češtinu s diakritikou, určená pro jednoduché hostování (např. GitHub Pages). Hra funguje jako čistý statický web – pouze HTML, CSS a vanilla JS v kořeni repozitáře.

## Soubory
- `index.html` – základní HTML struktura, modály, hrací deska a klávesnice.
- `style.css` – vzhled, animace (flip/shake), barevné stavy včetně fialové pro shodu základu.
- `app.js` – herní logika, ukládání do `localStorage`, statistiky, sdílení, admin override, klávesnice, toasty.
- `words.js` – seznam řešení a povolených slov (5 písmen, velká písmena, obsahuje diakritiku).
- `sw.js` – jednoduchý Service Worker pro offline cache po prvním načtení.

## Spuštění lokálně
1. Otevřete `index.html` přímo v prohlížeči **nebo** spusťte jednoduchý statický server, např.:
   ```bash
   python -m http.server 8000
   ```
2. Otevřete `http://localhost:8000/` (příp. `/index.html` pokud server slouží z jiného kořene).

## Nasazení na GitHub Pages
1. Commitujte všechny soubory v kořeni repozitáře.
2. V nastavení GitHubu zapněte Pages z větve `main` (root složka).
3. Díky relativním cestám (`./style.css`, `./app.js`…) bude aplikace fungovat i na podcestě, např. `https://uživatel.github.io/repozitář/`.

## Herní pravidla a barvy
- 6 řádků × 5 písmen, fyzická i on-screen klávesnice.
- Stavy dlaždic:
  - **Zelená** (`#6aaa64`) – přesná shoda (písmeno i diakritika, správná pozice).
  - **Žlutá** (`#c9b458`) – správné písmeno (včetně diakritiky), ale na jiné pozici.
  - **Fialová** (`#7b61ff`) – shoda základního písmene, ale s jinou diakritikou (např. S místo Š). Nepočítá se do výhry.
  - **Šedá** (`#787c7e`) – písmeno ve slově vůbec není (z hlediska základního písmene) nebo jsou všechny výskyty vyčerpány.
- Pořadí vyhodnocení (duplicitní písmena s diakritikou): 1) přesné shody, 2) žluté shody, 3) fialové základní shody, 4) zbytek šedý.

## Diakritika a validace
- Slova jsou uložená velkými písmeny s diakritikou.
- Zadávat můžete i bez diakritiky. Při validaci se porovnává základ slova (bez diakritiky) s `ALLOWED`. Pokud existuje shoda základu, vstup je přijat, ale použijí se vámi napsaná písmena – výsledkem mohou být fialové dlaždice.
- Výhra je možná pouze se všemi zelenými poli (fialová shoda základu není „správné“ písmeno).

## Denní/slovník/practice režim
- **Denní hra**: deterministické slovo podle epochy `2021-06-19`, plus volitelný admin override (viz níže).
- **Trénink**: náhodné slovo, přepíná se v nastavení a stav se ukládá zvlášť.
- Stav hry, nastavení (tmavý režim, kontrast, trénink) i statistiky se ukládají do `localStorage`.

## Sdílení výsledků
- Tlačítko „Sdílet“ kopíruje mřížku do schránky.
- Denní režim: obsahuje číslo dne a skóre (např. `Wordle CZ 124 3/6`).
- Tréninkový režim: označeno jako „Practice“ bez čísla dne.
- Emoji: 🟩 zelená, 🟨 žlutá, 🟪 fialová (shoda základu), ⬛ šedá.

## Admin override (klientské)
- Vpravo nahoře je tlačítko „Admin: new word“.
- Heslo: `Vincent`.
- Lze zadat nové dnešní slovo (musí být v `SOLUTIONS` nebo alespoň `ALLOWED`), případně slovo obnovit na oficiální denní výběr.
- Ukládá se do `localStorage` pod dnešním datem; jde o klientskou funkci, nikoli zabezpečení.

## Offline
- Po prvním načtení se pomocí `sw.js` do cache uloží hlavní soubory a hra funguje i offline.

## Úprava slovníků
- `SOLUTIONS` obsahuje kandidátní řešení (pětiznaková slova, diakritika povolena).
- `ALLOWED` zahrnuje `SOLUTIONS` a další povolené tipy. Vše ve velkých písmenech.
- Po úpravě stačí změnit `words.js`; není potřeba build krok.
