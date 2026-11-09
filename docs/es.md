# ORES para Gladys Assistant

Esta integración vigila la red de distribución de **ORES** (Valonia, Bélgica) para su
dirección: averías en curso, trabajos previstos con corte de suministro y retrasos
anunciados. Lee el mapa público de averías de ORES
([Pannes et interruptions](https://www.ores.be/pannes-et-interruptions/)).

> Integración **no oficial**, sin relación con ORES. Utiliza el servicio web sin
> autenticación del mapa público de averías de ores.be, que ORES puede modificar en
> cualquier momento.

Etiqueta: **cloud** (la integración consulta el sitio de ORES, no se lee nada en local).

## Configuración

| Campo                          | Obligatorio | Función                                                               |
| ------------------------------ | ----------- | --------------------------------------------------------------------- |
| Código postal                  | sí          | El municipio vigilado.                                                |
| Localidad                      | no          | Solo si varias localidades comparten el mismo código postal.          |
| Calle                          | no          | Para saber si **su** calle está afectada, no solo el municipio.       |
| Número                         | no          | Precisa su lado de la calle (ORES publica rangos pares/impares).      |
| Horizonte de trabajos (días)   | no          | Los trabajos anunciados más adelante se ignoran (7 días por defecto). |
| Intervalo de actualización (s) | no          | Frecuencia de lectura del mapa (300 s por defecto, 60 s como mínimo). |

Sin calle, todo el municipio cuenta como «su dirección». Los nombres de calle se comparan sin
acentos, mayúsculas ni puntuación: «Rue de l'Église» corresponde a «RUE DE L EGLISE».

El botón **Probar el mapa de averías de ORES** comprueba que el mapa responde e indica el
número de incidencias en la red y en su municipio.

## El dispositivo «ORES network status»

Tras la instalación, cree el dispositivo desde la pestaña **Descubrir**. Ofrece cuatro
sensores binarios (0/1):

- **Avería en mi dirección**: una avería no prevista le afecta;
- **Trabajos en mi dirección**: hay trabajos previstos con corte en curso en su casa;
- **Trabajos próximos en mi dirección**: hay trabajos anunciados dentro del horizonte elegido;
- **Incidencia en mi municipio**: al menos una avería u obra está en curso en el municipio.

## Disparadores de escena

| Disparador                        | Cuándo                                        |
| --------------------------------- | --------------------------------------------- |
| Inicio de avería o trabajos ORES  | comienza una avería u obra                    |
| Fin de avería o trabajos ORES     | termina una avería u obra en curso            |
| Avería o trabajos ORES retrasados | ORES anuncia un fin más tardío                |
| Trabajos ORES anunciados          | aparecen nuevos trabajos previstos en el mapa |

Filtros: **Tipo** (avería / trabajos previstos) y **Dónde** (en mi dirección / en otro lugar
de mi municipio). Variables para las acciones siguientes: `{{triggerEvent.data.reference}}`,
`city`, `start_time`, `end_time` (fechas ISO, UTC) y `customers` (clientes afectados).

La primera lectura tras la instalación (o un cambio de dirección) sirve de referencia: las
incidencias ya en curso no disparan nada. El estado se guarda en `/data`, de modo que un
reinicio no repite ni pierde ninguna transición.

## Acciones de escena

- **Comprobar una dirección en la red ORES**: cualquier dirección (segunda residencia,
  familiar...). Salidas: `outage`, `planned_interruption`, `upcoming_interruption`,
  `commune_incidents`, `reference`, `end_time`, `next_start_time`.
- **Obtener el estado de la red ORES**: el último estado conocido de su dirección, sin
  llamada de red, con las mismas salidas.

## Widget

El widget **Estado de la red ORES** muestra los sensores en directo, el estado de su
dirección, el número de incidencias en el municipio, la lista de averías y trabajos (detalle
al tocar) y un botón **Actualizar**.

## Consumo de gas y electricidad

Todavía no disponible. El portal my.ores.be no tiene API pública, y su inicio de sesión con
itsme o DNI electrónico no se puede automatizar. Una próxima versión lo añadirá mediante el
inicio de sesión con correo electrónico y contraseña de my.ores.be, si lo permite.

## Privacidad

Solo se descarga la lista pública de incidencias. Su dirección nunca sale de su Gladys: la
comparación se realiza en local.
