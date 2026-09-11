# UplowWork

Jeden film i opis na wybrane **TikTok, Facebook Reels, Instagram Reels i YouTube Shorts**. Lokalny panel jako rozszerzenie Chrome lub Edge, bez abonamentu i bez dodatkowego serwera.

**Wersja eksperymentalna 0.1.11.** Formularze platform były sprawdzane osobno. Pełna kolejka przez zainstalowane rozszerzenie oraz wszystkie kombinacje dodatkowych opcji wymagają dalszych testów. Zmiany interfejsów platform mogą wymagać aktualizacji aplikacji.

## Instalacja bez programowania

1. Pobierz **UplowWork-v0.1.11.zip** z [najnowszego wydania](https://github.com/szymongazinski/UplowWork/releases/latest) i rozpakuj w stałym miejscu na komputerze.
2. W Chrome otwórz `chrome://extensions`, a w Edge `edge://extensions`.
3. Włącz **Tryb dewelopera**, kliknij **Załaduj rozpakowane** i wskaż folder **UplowWork**, który zawiera `manifest.json`.
4. Panel otworzy się po instalacji. Kliknij **Połącz wszystkie** i zaloguj się na platformy w tej samej przeglądarce. Przypnij ikonę rozszerzenia, żeby łatwo wracać do panelu.

[Szczegółowa instrukcja](INSTRUKCJA.md). To instalacja lokalna rozszerzenia, nie strona GitHub Pages. Pobranie samego kodu źródłowego wymaga kompilacji opisanej niżej.

## Co potrafi

- Jeden plik, wspólny opis i wybór dowolnych platform.
- Domyślnie zaznaczone są wszystkie cztery platformy i widoczność **Publicznie — wszyscy**. Możesz przełączyć na **Prywatnie — tylko ja**. Strona Facebooka i Instagram są pomijane w trybie prywatnym, ponieważ nie ma potwierdzonej opcji „Tylko ja”.
- Dodatkowe ustawienia występują raz, z podpisem wskazującym platformy.
- Oddzielny status, zatrzymanie i ponowienie dla każdej platformy. Ponowienie używa tej samej karty i nie wysyła ponownie zakończonych platform.
- Sprawdzenie ustawień przed publikacją i blokada automatycznych duplikatów.

| Opcja | Platformy |
| --- | --- |
| Komentarze | TikTok, Instagram, YouTube |
| Widoczność liczby polubień | Instagram, YouTube; Instagram obejmuje też wyświetlenia |
| Oznaczenie realistycznych treści AI | Wszystkie cztery |
| Tytuł, materiał dla dzieci, płatna promocja, osadzanie | YouTube |

Domyślnie: film nie jest przeznaczony dla dzieci, komentarze i liczba polubień są widoczne, brak płatnej promocji, osadzanie na innych stronach jest dozwolone.

YouTube wyłącza komentarze w filmach dla dzieci. „Ustawienie platformy” zachowuje stan zastany w danym formularzu.

## Facebook: wyłącznie wybrana strona

W polu **Strona Facebooka do publikacji** zapisz link `https://www.facebook.com/profile.php?id=…`. Aplikacja przypina identyfikator strony do każdej wysyłki, otwiera jej panel i w razie potrzeby przełącza tożsamość z profilu osobistego. Po przeładowaniu Facebooka kontynuuje tę samą wysyłkę przed przesłaniem pliku.

Przed przekazaniem filmu i końcowym zatwierdzeniem sprawdza identyfikator aktywnej strony z nawigacji Facebooka. Sama nazwa strony lub otwarcie jej adresu nie wystarczają. Niezgodny albo niewidoczny identyfikator blokuje publikację; nie ma powrotu do publikowania na profilu osobistym. Zmiana ustawienia w panelu nie zmienia celu już zapisanej wysyłki.

Starsze wysyłki Facebooka bez przypisanej strony nie mogą zostać ponowione. Utwórz nową wysyłkę z zaznaczonym tylko Facebookiem. Historia pokazuje ID docelowej strony. Strony są obsługiwane z publiczną widocznością; test bez publikacji zatrzymuje się przed końcowym przyciskiem.

Ustawienie strony pozostaje lokalne. Publiczna paczka nie ma wybranej strony; instalacja przygotowana dla użytkownika może zawierać lokalny plik `local-settings.js`, który ustawia pierwszy cel. Późniejsze zmiany zapisane w rozszerzeniu mają pierwszeństwo.

## Sprawdzanie bez publikacji

Przycisk **Przygotuj filmy — zatwierdzę sam** uruchamia ten sam kod obsługi formularzy: przesyła film, uzupełnia opis, ustawia wybraną widoczność i sprawdza pozostałe opcje. Zatrzymuje się przed kliknięciem publikacji. Automatyczne publikowanie jest również zablokowane w service workerze. Plik trafia do wybranych serwisów; na ich stronach może pozostać nieopublikowany formularz lub szkic. W historii taki przebieg jest oznaczony **RĘCZNE ZATWIERDZENIE**. Ponowienie również zatrzyma się przed końcowym przyciskiem.

Instagram rozpoznaje angielskie pole „Add a caption...” i „Advanced Settings”. W kroku kadrowania automatycznie wybiera **Oryginał** i sprawdza proporcje oraz brak przycięcia obrazu, również na końcowym ekranie rolki. Pionowy film nie pozostaje w domyślnym kwadratowym kadrze.

Wersja 0.1.11 przygotowuje formularze i zawsze zatrzymuje się przed końcowym przyciskiem **Share / Publish / Schedule**. Użytkownik zatwierdza każdą platformę ręcznie w jej karcie. Dotyczy to również ponowień starszych wysyłek; kolejka odrzuca automatyczne zatwierdzenie publikacji. Dodano pauzy: 3 sekundy po przekazaniu filmu, po 1 sekundzie przed i po przejściu etapu oraz 1,5 sekundy przed końcowym sprawdzeniem. Kod nadal czeka na rzeczywistą gotowość elementów formularza. Pauzy nie gwarantują usunięcia błędów platform.

Przycisk **Przygotuj filmy — zatwierdzę sam** zastępuje automatyczne publikowanie. Status **Czeka na Twoje zatwierdzenie** oznacza przygotowany formularz, a nie opublikowany film. Jeśli ręcznie zatwierdzisz TikToka dopiero później, może być konieczne przesunięcie terminu planowania. Aplikacja nie potwierdza wyniku ręcznego kliknięcia; przed ponownym przygotowaniem sprawdź platformę, aby nie utworzyć duplikatu.

TikTok domyślnie używa **Zaplanuj**. Aplikacja po przygotowaniu filmu wybiera najbliższy lokalny termin oddalony o co najmniej 15 minut, zaokrąglony do dostępnego kroku 5 minut (zwykle 15–20 minut). Sprawdza odczytaną datę, godzinę, strefę i widoczność; ponowienie TikToka też oblicza nowy termin. Brak harmonogramu lub odrzucony termin zatrzymuje tę platformę. Nie przełącza się samoczynnie na „Teraz”. [TikTok opisuje minimum 15 minut w dokumentacji planowania](https://ads.tiktok.com/business/en-US/blog/introducing-video-scheduler-now-you-can-plan-tiktoks-in-advance).

Termin jest liczony bez dodatkowego zapasu: o 10:05:00 najbliższy to 10:20, a po przekroczeniu tej granicy — 10:25. Gdy termin wygaśnie podczas końcowego przygotowania, ale jeszcze przed zatwierdzeniem wysyłki, aplikacja przelicza go automatycznie. Po rozpoczęciu zatwierdzania nie ponawia publikacji.

Status **Zaplanowano** oznacza odebranie komunikatu potwierdzenia zapisania harmonogramu. Samo przejście do listy treści daje status niepotwierdzonego wysłania. Przed ponowieniem takiej próby sprawdź, czy film nie znajduje się już na liście zaplanowanych. Tryb **Sprawdź wysyłkę bez publikacji** ustawia termin w formularzu, ale nie klika końcowego przycisku „Zaplanuj”.

Przełączenie na stronę Facebooka i jej kreator rolki do ostatniego kroku, kontrolki daty i godziny oraz pionowe kadrowanie Instagrama sprawdzono na neutralnym filmie bez zatwierdzania publikacji. Nie potwierdzono końcowego zaplanowania na koncie użytkownika. Planowanie nie naprawia odrzucenia samego pliku przez TikToka; jeśli wystąpi ono przed przygotowaniem formularza, wysyłka pozostaje zatrzymana.

Testy offline uruchamiają rzeczywisty runner na formularzach testowych do etapu wyboru publiczności i zatwierdzenia, włącznie z blokadą publikacji w trybie testowym. Nie zastępują sprawdzenia konkretnego filmu i sesji w przeglądarce użytkownika. **Szczegóły zatrzymania** w historii zawierają wersję skryptu, etap, kod błędu oraz typy pól plików, bez haseł i plików cookie.

## Ponawianie i miniatury

W historii kliknij **Ponów tylko TikTok / Facebook / Instagram / YouTube**. Plik po błędzie pozostaje na komputerze. Gdy poprzednia próba mogła już opublikować film, najpierw otwórz platformę i zaznacz, że sprawdziłeś brak publikacji. Jeśli stara wersja usunęła plik, wybierz ponownie identyczny film u góry formularza; ponowienie sprawdzi jego zawartość i zachowa pierwotny opis oraz ustawienia. Pomyślnie opublikowany YouTube nie jest ponawiany. Zatrzymanie pojedynczej platformy nie anuluje pozostałych.

Miniaturę można przygotować z obrazu JPG/PNG do 2 MB albo automatycznie z klatki w połowie filmu. Generowanie odbywa się lokalnie, bez zmieniania pliku wideo; wynik można też pobrać. Jedną miniaturę przypisujesz do wybranych platform. Potwierdzono formularze przesyłania okładek TikToka i Instagrama. Facebook Reels otwiera edytor miniatury w ostatnim kroku ustawień rolki, przesyła obraz JPG/PNG, zapisuje go i sprawdza ten sam obraz w podglądzie przed publikacją. Facebook jest domyślnie zaznaczony na liście odbiorców wybranej miniatury. [Własne miniatury Shorts są wdrażane zależnie od konta YouTube](https://blog.youtube/news-and-events/youtube-studio-custom-thumbnail-updates/). Jeśli pole nie jest dostępne lub brak potwierdzenia miniatury, ta platforma zatrzyma się przed publikacją; można ponowić z domyślną miniaturą.

Aktualizacja 0.1.4 poprawiła wybór pola rolki Facebooka (oddzielonego od pól zwykłego posta), ignorowanie ukrytych formularzy, otwieranie kreatora Instagrama i obsługę odrzuconych przesyłań TikToka. Testy obejmują konkurujące ponowienia, nieaktualne próby i zachowanie pliku po błędzie. Przejście formularzy i okładek sprawdzono bez publikacji publicznych; nie jest to potwierdzenie całej kolejki na każdej konfiguracji kont.

## Hashtagi i podgląd

Hashtagi wpisujesz w osobnym polu, ze znakiem # lub bez. Aplikacja usuwa powtórzenia, zachowuje polskie znaki i dopisuje blok hashtagów na końcu opisu po jednym pustym wierszu. Nie dodaje automatycznie #shorts, #reels ani #fyp. Hashtagi zapisane już w opisie możesz przenieść do osobnego pola jednym kliknięciem.

Dla Instagrama używane jest pierwszych 5 hashtagów. TikTok również otrzymuje pierwszych 5 jako ustawienie zgodności aplikacji z wariantami formularza — nie jest to deklaracja uniwersalnego limitu TikToka. YouTube otrzymuje do 60 hashtagów łącznie z tymi w tytule, a Facebook wszystkie poprawne hashtagi, o ile cały opis mieści się w limicie aplikacji 2200 znaków. Licznik wskazuje pominięte hashtagi; końcowy tekst jest widoczny w podglądzie każdej platformy.

Podgląd mobilny ma cztery układy z ikonami, paskami, nazwą konta, opisem i dźwiękiem. Można odtwarzać film, przewijać go i rozwinąć opis. YouTube pokazuje tytuł na filmie i osobny panel opisu. Liczniki i nazwa konta są poglądowe, układ zależy od wersji aplikacji i ekranu. Nakładka nie jest dodawana do przesyłanego pliku.

Dokumentacja: [hashtagi w YouTube](https://support.google.com/youtube/answer/6390658), [hashtagi a osobne tagi wideo YouTube](https://support.google.com/youtube/answer/146402), [opis i hashtagi w Facebook Reels](https://www.facebook.com/help/www/2862139500770200), [wskazówki TikToka](https://newsroom.tiktok.com/5-tips-for-tiktok-creators?lang=en). Limit Instagrama uwzględnia komunikat @creators z grudnia 2025; ograniczenia formularzy mogą się zmieniać.

## Urządzenia i ograniczenia

Projekt przeznaczony jest do komputerowych wersji Chrome i Edge na Windows, macOS oraz Linux. Wersję przygotowano na Windows; pozostałe systemy wymagają sprawdzenia. Nie ma wersji na Androida, iPhone'a ani Safari. Na każdym urządzeniu trzeba zainstalować rozszerzenie i zalogować konta; historia i pliki nie synchronizują się automatycznie.

Przeglądarka musi działać podczas wysyłki. Obsługiwane pliki: MP4, MOV, WebM, do 100 MB i 3 minut, w pionie lub kwadracie. Najbardziej przewidywalny jest MP4/H.264. Obsługa formularzy obejmuje polskie i angielskie etykiety; warianty języka i interfejsu mogą wymagać dostosowania.

To automatyzacja widocznych formularzy platform, a nie integracja z ich oficjalnymi API. CAPTCHA lub ponowne logowanie wymagają działania użytkownika. Status „przetwarzanie” nie jest potwierdzeniem zakończonej publikacji. Przy braku jednoznacznego wyniku sprawdź platformę przed kolejną próbą.

## Dane i dostęp

Pliki oraz historia kolejki są zapisywane lokalnie w IndexedDB. Plik i miniatura są zachowywane dla wysyłek błędnych lub z niepotwierdzonym wynikiem, aby umożliwić ponowienie; po potwierdzeniu wszystkich platform są usuwane z pamięci rozszerzenia. Film trafia na wybrane platformy. Rozszerzenie nie odczytuje haseł ani plików cookie i nie wysyła danych do dodatkowego pośrednika. Uprawnienia do kart i skryptów służą obsłudze formularzy wyłącznie czterech zadeklarowanych domen.

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
