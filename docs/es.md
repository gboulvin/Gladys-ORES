# ORES para Gladys Assistant

Esta integración vigila la red de distribución de **ORES** (Valonia, Bélgica) en su domicilio
y, opcionalmente, en una segunda dirección: averías en curso, trabajos previstos con corte de
suministro y retrasos anunciados. Lee el mapa público de averías de ORES
([Pannes et interruptions](https://www.ores.be/pannes-et-interruptions/)).

> Integración **no oficial**, sin relación con ORES. Utiliza el servicio web sin autenticación
> del mapa público de averías de ores.be, que ORES puede modificar en cualquier momento.

Etiqueta: **cloud** (la integración consulta el sitio de ORES, no se lee nada en local).

## Configuración

### Domicilio

Por defecto, el domicilio es **su casa de Gladys** (Ajustes → Casas, con su posición en el
mapa). La integración pide a Gladys la ubicación de las casas (una autorización mostrada en la
instalación). Gladys solo da coordenadas GPS: la integración las convierte **una sola vez** en
dirección postal mediante
[OpenStreetMap Nominatim](https://operations.osmfoundation.org/policies/nominatim/) y guarda el
resultado en `/data`. Las coordenadas no se envían a ningún otro sitio, nunca a ORES.

| Campo                   | Función                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| Dirección del domicilio | «Ubicación de la casa de Gladys» (por defecto) o «Dirección indicada abajo». |
| Casa de Gladys          | Nombre de la casa si Gladys tiene varias (vacío: la primera ubicada).        |

El botón **Probar el mapa de averías de ORES** muestra la dirección encontrada: compruébela. Si
es incorrecta (posición imprecisa, casa en una esquina...), elija «Dirección indicada abajo» y
rellene los campos.

¿Viene de la versión 0.1? Mientras no guarde la configuración, se sigue usando la dirección que
había escrito.

### Dirección escrita a mano

| Campo         | Función                                                          |
| ------------- | ---------------------------------------------------------------- |
| Código postal | Obligatorio en modo manual: el municipio vigilado.               |
| Localidad     | Solo si varias localidades comparten el mismo código postal.     |
| Calle         | Para saber si **su** calle está afectada, no solo el municipio.  |
| Número        | Precisa su lado de la calle (ORES publica rangos pares/impares). |

Sin calle, todo el municipio cuenta como «su dirección». Los nombres de calle se comparan sin
acentos, mayúsculas ni puntuación: «Rue de l'Église» corresponde a «RUE DE L EGLISE».

### Segunda dirección (opcional)

Otra dirección a vigilar: segunda residencia, padres, lugar de trabajo... Dele un **nombre**
(por ejemplo «Padres») y rellene al menos su código postal. Tiene su propio dispositivo, y los
disparadores, la acción de escena y el widget pueden apuntar a ella. Vacíe el código postal
para desactivarla.

### Otros ajustes

- **Horizonte de trabajos (días)**: los trabajos anunciados más adelante se ignoran (7 por
  defecto).
- **Intervalo de actualización (s)**: frecuencia de lectura del mapa (300 s por defecto, 60 s
  como mínimo).

## Los dispositivos «ORES network status»

Créelos desde la pestaña **Descubrir**: uno para el domicilio y otro para la segunda dirección.
Cada uno ofrece cuatro sensores binarios (0/1):

- **Avería en mi dirección**: una avería no prevista afecta a la dirección;
- **Trabajos en mi dirección**: hay trabajos previstos con corte en curso allí;
- **Trabajos próximos en mi dirección**: hay trabajos anunciados dentro del horizonte elegido;
- **Incidencia en mi municipio**: al menos una avería u obra está en curso en el municipio.

## Disparadores de escena

| Disparador                        | Cuándo                                        |
| --------------------------------- | --------------------------------------------- |
| Inicio de avería o trabajos ORES  | comienza una avería u obra                    |
| Fin de avería o trabajos ORES     | termina una avería u obra en curso            |
| Avería o trabajos ORES retrasados | ORES anuncia un fin más tardío                |
| Trabajos ORES anunciados          | aparecen nuevos trabajos previstos en el mapa |

Filtros: **Dirección** (domicilio / segunda dirección), **Tipo** (avería / trabajos previstos)
y **Dónde** (en la dirección / en otro lugar del municipio). Variables para las acciones
siguientes: `{{triggerEvent.data.reference}}`, `city`, `start_time`, `end_time` (fechas ISO,
UTC) y `customers` (clientes afectados).

La primera lectura tras la instalación (o un cambio de dirección) sirve de referencia: las
incidencias ya en curso no disparan nada. El estado se guarda en `/data`, de modo que un
reinicio no repite ni pierde ninguna transición.

## Acciones de escena

- **Comprobar una dirección en la red ORES**: cualquier dirección, escrita en la escena.
  Salidas: `outage`, `planned_interruption`, `upcoming_interruption`, `commune_incidents`,
  `reference`, `end_time`, `next_start_time`.
- **Obtener el estado de la red ORES**: el último estado conocido del domicilio o de la segunda
  dirección (campo **Dirección**), sin llamada de red, con las mismas salidas.

## Widget

El widget **Estado de la red ORES** muestra los sensores en directo, el estado de la dirección,
el número de incidencias en el municipio, la lista de averías y trabajos (detalle al tocar) y
un botón **Actualizar**. Su ajuste **Dirección** elige el domicilio o la segunda dirección:
añada dos widgets para ver ambas.

## Consumo de gas y electricidad

No previsto. El portal my.ores.be no tiene API pública y solo acepta el inicio de sesión con
itsme o DNI electrónico (el inicio de sesión con correo y contraseña se ha abandonado). Estos
inicios de sesión requieren una aprobación humana cada vez y no se pueden automatizar.

Sigue siendo posible una importación puntual de la exportación de consumo de my.ores.be. Si le
interesa, abra una [incidencia](https://github.com/gboulvin/Gladys-ORES/issues).

## Privacidad

- De ORES solo se descarga la lista pública de incidencias. Sus direcciones nunca salen de su
  Gladys: la comparación se realiza en local.
- En modo «casa de Gladys», las coordenadas de la casa se envían una sola vez a OpenStreetMap
  Nominatim (y luego cada vez que la casa cambia de lugar). Escriba su dirección a mano para
  evitarlo.
- Las direcciones nunca se escriben en los registros.
