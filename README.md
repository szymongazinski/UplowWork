# UplowWork

Jeden film i opis na wybrane **TikTok, Facebook Reels, Instagram Reels i YouTube Shorts**. Lokalny panel jako rozszerzenie Chrome lub Edge, bez abonamentu i bez dodatkowego serwera.

**Wersja eksperymentalna 0.1.1.** Formularze platform były sprawdzane osobno. Pełna kolejka przez zainstalowane rozszerzenie oraz wszystkie kombinacje dodatkowych opcji wymagają dalszych testów. Zmiany interfejsów platform mogą wymagać aktualizacji aplikacji.

## Instalacja bez programowania

1. Pobierz **UplowWork-v0.1.1.zip** z [najnowszego wydania](https://github.com/szymongazinski/UplowWork/releases/latest) i rozpakuj w stałym miejscu na komputerze.
2. W Chrome otwórz `chrome://extensions`, a w Edge `edge://extensions`.
3. Włącz **Tryb dewelopera**, kliknij **Załaduj rozpakowane** i wskaż folder **UplowWork**, który zawiera `manifest.json`.
4. Panel otworzy się po instalacji. Kliknij **Połącz wszystkie** i zaloguj się na platformy w tej samej przeglądarce. Przypnij ikonę rozszerzenia, żeby łatwo wracać do panelu.

[Szczegółowa instrukcja](INSTRUKCJA.md). To instalacja lokalna rozszerzenia, nie strona GitHub Pages. Pobranie samego kodu źródłowego wymaga kompilacji opisanej niżej.

## Co potrafi

- Jeden plik, wspólny opis i wybór dowolnych platform.
- Domyślnie zaznaczone są wszystkie cztery platformy i widoczność **Publicznie — wszyscy**. Możesz przełączyć na **Prywatnie — tylko ja**. Instagram jest w trybie prywatnym pomijany, ponieważ w sprawdzonym formularzu nie było takiej opcji.
- Dodatkowe ustawienia występują raz, z podpisem wskazującym platformy.
- Oddzielny status każdej wysyłki, trwała kolejka i zatrzymanie kolejnych wysyłek.
- Sprawdzenie ustawień przed publikacją i blokada automatycznych duplikatów.

| Opcja | Platformy |
| --- | --- |
| Komentarze | TikTok, Instagram, YouTube |
| Widoczność liczby polubień | Instagram, YouTube; Instagram obejmuje też wyświetlenia |
| Oznaczenie realistycznych treści AI | Wszystkie cztery |
| Tytuł, materiał dla dzieci, płatna promocja, osadzanie | YouTube |

Domyślnie: film nie jest przeznaczony dla dzieci, komentarze i liczba polubień są widoczne, brak płatnej promocji, osadzanie na innych stronach jest dozwolone.

YouTube wyłącza komentarze w filmach dla dzieci. „Ustawienie platformy” zachowuje stan zastany w danym formularzu.

## Urządzenia i ograniczenia

Projekt przeznaczony jest do komputerowych wersji Chrome i Edge na Windows, macOS oraz Linux. Wersję przygotowano na Windows; pozostałe systemy wymagają sprawdzenia. Nie ma wersji na Androida, iPhone'a ani Safari. Na każdym urządzeniu trzeba zainstalować rozszerzenie i zalogować konta; historia i pliki nie synchronizują się automatycznie.

Przeglądarka musi działać podczas wysyłki. Obsługiwane pliki: MP4, MOV, WebM, do 100 MB i 3 minut, w pionie lub kwadracie. Najbardziej przewidywalny jest MP4/H.264. Obsługa formularzy obejmuje polskie i angielskie etykiety; warianty języka i interfejsu mogą wymagać dostosowania.

To automatyzacja widocznych formularzy platform, a nie integracja z ich oficjalnymi API. CAPTCHA lub ponowne logowanie wymagają działania użytkownika. Status „przetwarzanie” nie jest potwierdzeniem zakończonej publikacji. Przy braku jednoznacznego wyniku sprawdź platformę przed kolejną próbą.

## Dane i dostęp

Pliki oraz historia kolejki są zapisywane lokalnie w IndexedDB. Film trafia na wybrane platformy. Rozszerzenie nie odczytuje haseł ani plików cookie i nie wysyła danych do dodatkowego pośrednika. Uprawnienia do kart i skryptów służą obsłudze formularzy wyłącznie czterech zadeklarowanych domen.

Repozytorium i paczka nie zawierają kont, sesji, filmów ani adresów prywatnych publikacji z testów.

## Uruchomienie ze źródeł

Wymagany Node.js 22.13 lub nowszy.

```sh
npm ci
npm test
npm run build
```

Folder wynikowy **UplowWork** można załadować do przeglądarki. `npm run dev` uruchamia podgląd panelu pod `http://127.0.0.1:5173`; podgląd nie publikuje filmów. Właściwa wysyłka działa w kontekście rozszerzenia.

Kod panelu znajduje się w `extension/main.jsx`, kolejki w `extension/background.js`, obsługi formularzy w `extension/runner.js`, a walidacji w `extension/policy.js` i `extension/options.js`. Testy sprawdzają m.in. zakres wspólnych opcji, prywatność, blokowanie duplikatów oraz transakcje IndexedDB.
