import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { BackButton } from '@/components/ui/BackButton';
import { useTranslations } from '@/context/LanguageContext';

const PRIVACY_POLICY = `Posledná aktualizácia: jún 2026

Woeva je mobilná aplikácia prevádzkovaná spoločnosťou Sportqo s.r.o. Tieto zásady vysvetľujú, aké osobné údaje zbierame, prečo ich zbierame a aké máte práva podľa Nariadenia EÚ 2016/679 (GDPR) a platného slovenského práva.

PREVÁDZKOVATEĽ OSOBNÝCH ÚDAJOV

Sportqo s.r.o.
Mudrochova 7480/15, 831 06 Bratislava – mestská časť Rača, Slovensko
IČO: 56132433 | DIČ: 2122213775 | IČ DPH: SK2122213775
E-mail: admin@woeva.com
Telefón: +421 915 786 829

1. ÚDAJE, KTORÉ ZBIERAME

Účet
• Meno, e-mailová adresa a profilová fotografia pri registrácii e-mailom/heslom alebo cez Apple/Google Sign-In (pri sociálnom prihlásení dostaneme len údaje, ktoré povolíte).

Poloha
• Mesto (uložené v profile) a približné GPS súradnice (len ak udelíte povolenie) na zobrazovanie udalostí vo vašej blízkosti. GPS sa neukladá – používa sa iba počas relácie.

Zariadenie a notifikácie
• Push notification token na doručovanie upozornení.

Obsah
• Udalosti, kluby, fotografie udalostí a správy v chatoch udalostí.

Aktivita
• Udalosti, na ktoré ste sa prihlásili alebo odhlásili, lístky, členstvá v kluboch, recenzie.

Platby
• Platby kartou spracúva Stripe. My uchovávame iba Stripe customer ID – žiadne čísla kariet ani CVV.

Apple Wallet
• Vaše meno a detaily udalosti sú vložené do priepustky doručenej priamo do vášho zariadenia a uloženej výhradne v Apple Wallet.

Fotoaparát / fotogaléria
• Používané výlučne pri nahrávaní fotografií, ktoré vyberiete.

2. AKO VAŠE ÚDAJE POUŽÍVAME
• Poskytovanie, prevádzka a personalizácia aplikácie Woeva
• Zobrazovanie vašich udalostí a profilu ostatným používateľom
• Zasielanie push notifikácií a e-mailov o udalostiach, na ktoré ste prihlásení alebo ktoré spravujete
• Spracovanie platby lístkov a vystavovanie refundácií cez Stripe
• Generovanie priepustiek Apple Wallet na požiadanie
• Zobrazovanie udalostí relevantných pre vašu polohu (GPS sa neukladá)

3. PRÁVNY ZÁKLAD (GDPR)
• Plnenie zmluvy: správa účtu, registrácia na udalosti, platby
• Oprávnený záujem: push notifikácie o udalostiach, na ktoré ste sa prihlásili, bezpečnostný monitoring
• Súhlas: prístup k GPS polohe, voliteľné marketingové komunikácie

4. ZDIEĽANIE ÚDAJOV
• Vaše osobné údaje nepredávame žiadnej tretej strane
• Stripe (stripe.com) – spracovanie platieb podľa vlastných zásad Stripe
• Apple / Google – sociálne prihlásenie podľa ich vlastných zásad
• Supabase – databáza a autentifikačná infraštruktúra (dátová oblasť EÚ)
• Expo – doručovanie push notifikácií
• Žiadne ďalšie tretie strany nemajú prístup k vašim osobným údajom

5. VAŠE PRÁVA (GDPR)
Máte právo na:
• Prístup: vyžiadať kópiu svojich osobných údajov
• Opravu: opraviť nepresné údaje cez Nastavenia → Profil
• Vymazanie: zmazať účet a všetky údaje cez Nastavenia → Zmazať účet
• Prenosnosť: vyžiadať údaje v strojovo čitateľnom formáte
• Námietku: odmietnuť spracovanie na základe oprávnených záujmov
• Odvolanie súhlasu: kedykoľvek odvolať povolenia na polohu alebo notifikácie v nastaveniach zariadenia

Na uplatnenie ktoréhokoľvek práva nás kontaktujte na admin@woeva.com. Odpovieme do 30 dní.

6. UCHOVÁVANIE ÚDAJOV
Vaše údaje uchovávame po dobu aktivity vášho účtu. Zmazaním účtu sa natrvalo odstráni váš profil, udalosti, kluby, správy, lístky a všetky súvisiace údaje do 30 dní.

7. DETI
Woeva nie je určená deťom mladším ako 16 rokov. Vedome nezbierame údaje od osôb mladších ako 16 rokov.

8. KONTAKT A SŤAŽNOSTI
Sportqo s.r.o.
E-mail: admin@woeva.com
Telefón: +421 915 786 829
Mudrochova 7480/15, 831 06 Bratislava – mestská časť Rača, Slovensko

Máte tiež právo podať sťažnosť na Úrad na ochranu osobných údajov SR (dataprotection.gov.sk).`;

const TERMS = `Posledná aktualizácia: jún 2026

Stiahnutím alebo používaním aplikácie Woeva súhlasíte s týmito Podmienkami používania. Prečítajte si ich pozorne.

Prevádzkovateľ:
Sportqo s.r.o., Mudrochova 7480/15, 831 06 Bratislava – mestská časť Rača, Slovensko
IČO: 56132433 | DIČ: 2122213775 | IČ DPH: SK2122213775
E-mail: admin@woeva.com | Tel.: +421 915 786 829

1. VEKOVÉ OBMEDZENIE
Woeva môžu používať osoby staršie ako 16 rokov. Používaním aplikácie potvrdzujete, že spĺňate túto podmienku.

2. ZODPOVEDNOSŤ ZA ÚČET
Ste zodpovední za bezpečnosť svojich prihlasovacích údajov a za všetky aktivity uskutočnené pod vaším účtom. V prípade podozrenia na neoprávnený prístup nás ihneď kontaktujte na admin@woeva.com. Prihlásiť sa môžete e-mailom/heslom, Apple Sign-In alebo Google Sign-In.

3. OBSAH
Zostávate vlastníkom obsahu, ktorý vytvárate (udalosti, kluby, fotografie, správy). Zverejnením obsahu udeľujete Woeva nevýhradnú, bezplatnú licenciu na jeho zobrazenie v rámci aplikácie ostatným používateľom. Nesmie byť zverejnený obsah, ktorý je nezákonný, škodlivý, zavádzajúci, diskriminačný alebo porušuje práva tretích strán.

4. UDALOSTI
Organizátori udalostí sú zodpovední za presnosť informácií vrátane dátumu, času, miesta a ceny. Woeva je platforma spájajúca organizátorov a účastníkov – nie sme organizátorom žiadnej udalosti uvedenej v aplikácii.

5. LÍSTKY A PLATBY
Platené lístky sú spracovávané cez Stripe. K dispozícii sú aj lístky s platbou na mieste. Pre vaše lístky sú dostupné priepustky Apple Wallet.

Refundačná politika:
• Plná refundácia, ak organizátor udalosť zruší (automaticky)
• Z platených eventov sa nie je možné odhlásiť — lístok je záväzný
• Refundáciu zabezpečuje Sportqo s.r.o. prostredníctvom Stripe

Refundácie sa spracujú na pôvodnú platobnú metódu do 5–10 pracovných dní.

6. KLUBY
Vlastníci klubov môžu pozvať adminov. Pozvánky sa zasielajú v aplikácii a musia byť prijaté. Admini môžu spravovať udalosti v mene klubu. Vlastníci klubov zodpovedajú za súlad všetkých aktivít klubu s týmito podmienkami.

7. ZAKÁZANÉ KONANIE
Je zakázané:
• Vydávať sa za inú osobu alebo subjekt
• Obťažovať, vyhrážať sa alebo zneužívať ostatných používateľov
• Zverejňovať spam alebo nevyžiadaný propagačný obsah
• Využívať aplikáciu na akýkoľvek nezákonný účel
• Systematicky extrahovať dáta z platformy
• Pokúšať sa narušiť bezpečnosť alebo integritu platformy
• Vytvárať falošné udalosti alebo zavádzať účastníkov

8. UKONČENIE ÚČTU
Vyhradzujeme si právo pozastaviť alebo natrvalo zmazať účty porušujúce tieto podmienky, podľa vlastného uváženia, s upozornením alebo bez neho.

9. OBMEDZENIE ZODPOVEDNOSTI
Woeva je poskytovaná „tak, ako je" bez akýchkoľvek záruk. Nezodpovedáme za presnosť informácií o udalostiach zverejnených tretími stranami, ich zrušenie ani za škody vzniknuté používaním platformy, v rozsahu povolenom platným právom.

10. ZMENY PODMIENOK
Podmienky môžeme čas od času aktualizovať. Pokračovaním v používaní aplikácie po zmenách vyjadrujete súhlas s aktualizovanými podmienkami. O podstatných zmenách budete informovaní v aplikácii.

11. ROZHODNÉ PRÁVO
Tieto podmienky sa riadia právom Slovenskej republiky. Akékoľvek spory podliehajú právomoci slovenských súdov, bez toho, aby boli dotknuté vaše práva spotrebiteľa podľa práva EÚ.

12. KONTAKT
Otázky alebo sťažnosti:
Sportqo s.r.o.
E-mail: admin@woeva.com
Telefón: +421 915 786 829
Mudrochova 7480/15, 831 06 Bratislava – mestská časť Rača, Slovensko`;

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type: 'privacy' | 'terms' }>();
  const { t } = useTranslations();

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? t.about.privacyPolicy : t.about.termsOfService;
  const content = isPrivacy ? PRIVACY_POLICY : TERMS;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.body}>{content}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', fontFamily: Fonts.bold, color: Colors.black },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  body: { fontSize: 13, color: Colors.gray, lineHeight: 22, fontFamily: Fonts.regular },
});
