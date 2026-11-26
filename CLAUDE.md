Lis attentivement le fichier `CLAUDE.md` pour comprendre la vision, l'esthétique et les règles du projet.

Je veux construire la première version complète et fonctionnelle de **HOUSE INTELLIGENCE**, un site web ludique et éditorial inspiré de `dub.ninja`, dédié à l'histoire, aux machines et à la sociologie de la musique House.

Voici les étapes à exécuter dans l'ordre :

1. **Structurer les données (`data/`)** :
   - Complète `data/tracks.json` avec l'ensemble des 14 sous-genres définis (Chicago House, Acid House, Garage House NYC, Hip-House, Detroit, Deep House, Tribal House NYC incluant Victor Calderone, Balearic House, French Touch, Tech House, UK Garage, Afro House, Lo-Fi House, Amapiano), en veillant à ce que chaque morceau possède tous les champs (`construction`, `producer_origins`, `club_sociology`, `queer_ballroom_axis`, `gear`, `archive_ref`, `why_this_record`, `bpm`, `camelot_key`, `energy`).
   - Crée `data/machines.json` avec des fiches détaillées sur le détournement historique des machines clés (`Roland TR-808`, `Roland TR-909`, `Roland TR-707`, `Roland TB-303`, `Yamaha DX100`, `Akai MPC60`, `E-mu SP-1200`, `Log Drum`).
   - Crée `data/sources.json` résumant l'apport de nos œuvres de référence (*Modulations*, *Paris is Burning*, *Last Night a DJ Saved My Life*, *History of House* de Chris Kempster, *Join the Future* de Matt Anniss, *You Better Work!* de Kai Fikentscher, *Adventures in Wonderland* de Sheryl Garratt, *Soul Underground*, *Energy Never Dies*).

2. **Développer l'interface interactive (`index.html`, `styles.css`, `app.js`)** :
   - **Header & Navigation par Époques / Sous-genres** : Filtrage fluide par les 3 grandes ères historiques ou par les 14 sous-genres.
   - **The Booth (Zone centrale façon Dub.ninja)** :
     - Affiche le disque en cours avec ses badges techniques (`BPM`, `Clé Camelot`, `Énergie /10`, `Label`, `Ville`, `Année`).
     - Affiche un **visualiseur de transition** vers le disque suivant recommandé (calculé via un algorithme réel de compatibilité harmonique Camelot + proximité de BPM), indiquant le delta de tempo, le mouvement de clé et l'explication narrative de transition.
     - Intègre un **synthétiseur Web Audio API ludique (boîte à rythmes / pattern generator minimal)** qui génère un pulse rythmique au BPM exact du morceau sélectionné (avec option kick 909, sub 808 ou filtre acide 303) pour que l'utilisateur ressente immédiatement la différence de tempo et de groove entre un morceau Amapiano à 113 BPM, une Chicago House à 121 BPM et un UK Garage à 132 BPM !
   - **Steer the Room (Boutons d'orientation)** : 6 boutons d'intention musicale et culturelle qui orientent dynamiquement la sélection suivante.
   - **Panneau d'Archéologie Culturelle (4 onglets sur la fiche active)** :
     - *Machines & Construction* (avec badges cliquables ouvrant la fiche machine).
     - *Origines & Approche Producteur*.
     - *Axe Ballroom & Scènes Queer*.
     - *Sociologie du Club & Référence Bibliographique* (cliquable vers la fiche livre/film).
   - **The Memory (Historique de session)** : Timeline horodatée des morceaux explorés avec bouton d'export de la tracklist en Markdown/JSON.

3. **Vérification** :
   - Lance un serveur local léger pour vérifier qu'il n'y a aucune erreur console et que toutes les interactions (transitions Camelot, filtres machines, audio pulse, navigation) fonctionnent parfaitement.

Commence par créer les fichiers de données dans `data/`, puis développe l'interface.