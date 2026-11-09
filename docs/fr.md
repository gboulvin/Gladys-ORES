# ORES pour Gladys Assistant

Cette intégration surveille le réseau de distribution **ORES** (Wallonie, Belgique) pour
votre adresse : pannes en cours, travaux planifiés avec coupure, retards annoncés. Elle lit
la carte publique des pannes d'ORES ([Pannes et interruptions](https://www.ores.be/pannes-et-interruptions/)).

> Intégration **non officielle**, sans lien avec ORES. Elle utilise le service web qui
> alimente la carte publique des pannes du site ores.be, sans authentification. ORES peut
> le modifier à tout moment.

Tag : **cloud** (l'intégration interroge le site d'ORES, rien n'est lu en local).

## Configuration

| Champ                       | Obligatoire | Rôle                                                                |
| --------------------------- | ----------- | ------------------------------------------------------------------- |
| Code postal                 | oui         | La commune surveillée.                                              |
| Localité                    | non         | Uniquement si plusieurs localités partagent le même code postal.    |
| Rue                         | non         | Pour savoir si **votre** rue est touchée, pas seulement la commune. |
| Numéro                      | non         | Affine à votre côté de la rue (ORES publie des plages pair/impair). |
| Horizon des travaux (jours) | non         | Les travaux annoncés plus tard sont ignorés (7 jours par défaut).   |
| Intervalle (s)              | non         | Fréquence de lecture de la carte (300 s par défaut, 60 s minimum).  |

Sans rue, toute la commune compte comme « votre adresse ». La rue est comparée sans accents,
ni majuscules, ni ponctuation : « Rue de l'Église » correspond à « RUE DE L EGLISE ».

Le bouton **Tester la carte des pannes ORES** vérifie que la carte répond et indique le nombre
d'incidents sur le réseau et dans votre commune.

## L'appareil « ORES network status »

Après installation, créez l'appareil depuis l'onglet **Découverte**. Il expose quatre
capteurs binaires (0/1) :

- **Panne à mon adresse** : une panne non planifiée vous touche ;
- **Travaux à mon adresse** : des travaux planifiés avec coupure sont en cours chez vous ;
- **Travaux à venir à mon adresse** : des travaux sont annoncés dans l'horizon choisi ;
- **Incident dans ma commune** : au moins une panne ou un chantier est en cours dans la commune.

Ils servent dans les scènes classiques (« état d'un appareil ») et sur le tableau de bord.

## Déclencheurs de scène

| Déclencheur                       | Quand                                                   |
| --------------------------------- | ------------------------------------------------------- |
| Début de panne ou de travaux ORES | une panne ou un chantier commence                       |
| Fin de panne ou de travaux ORES   | une panne ou un chantier en cours se termine            |
| Panne ou travaux ORES en retard   | ORES annonce une fin plus tardive                       |
| Travaux ORES annoncés             | de nouveaux travaux planifiés apparaissent sur la carte |

Filtres : **Type** (panne / travaux planifiés) et **Où** (à mon adresse / ailleurs dans ma
commune). Variables disponibles dans les actions suivantes :
`{{triggerEvent.data.reference}}`, `city`, `start_time`, `end_time` (dates ISO, UTC) et
`customers` (clients impactés).

Exemple : « Quand une panne commence à mon adresse, m'envoyer un message avec
`{{triggerEvent.data.end_time}}` et couper le chauffe-eau au retour du courant ».

La première lecture après l'installation (ou un changement d'adresse) sert de référence : les
incidents déjà en cours ne déclenchent rien. L'état est conservé dans `/data`, donc un
redémarrage ne rejoue ni ne perd de transition.

## Actions de scène

- **Vérifier une adresse sur le réseau ORES** : n'importe quelle adresse (seconde résidence,
  proche…). Sorties : `outage`, `planned_interruption`, `upcoming_interruption`,
  `commune_incidents`, `reference`, `end_time`, `next_start_time`.
- **Obtenir le statut du réseau ORES** : le dernier statut connu de votre adresse, sans
  appel réseau, avec les mêmes sorties.

## Widget

Le widget **Statut du réseau ORES** affiche les capteurs en direct, l'état de votre adresse,
le nombre d'incidents dans la commune, la liste des pannes et travaux (détail au toucher) et
un bouton **Actualiser**.

## Consommations gaz et électricité

Pas encore disponibles. Le portail my.ores.be n'a pas d'API publique, et sa connexion par
itsme ou carte d'identité ne peut pas être automatisée. Une prochaine version les ajoutera
via la connexion e-mail / mot de passe de my.ores.be, si elle le permet.

## Confidentialité

Seule la liste publique des incidents est téléchargée. Votre adresse ne quitte jamais votre
Gladys : la correspondance est faite localement.
