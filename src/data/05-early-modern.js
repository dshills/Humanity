/* HT.events — Early modern era, 1500–1800 (CONTRACT.md §6)
 *
 * Tier is the coarsest view at which the event appears, judged against all of
 * human history (CONTRACT.md §3). Dates are the commonly cited values; day
 * precision is used wherever the exact date is well established, ranges for
 * reigns, wars and other periods. Every event carries a `link` to the English
 * Wikipedia article about it.
 */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  HT.events.push(
    // ---- 1500–1550 ---------------------------------------------------------
    {
      t: ce(1500, 4, 22),
      title: "Cabral's fleet reaches Brazil and claims it for Portugal",
      detail: "Bound for India by a wide westward arc, Pedro Álvares Cabral sighted Monte Pascoal and spent ten days on the coast, claiming the land for Portugal; Brazil became the largest Portuguese-speaking country in the world.",
      tier: 4, category: 'exploration',
      link: 'https://en.wikipedia.org/wiki/Pedro_%C3%81lvares_Cabral'
    },
    {
      t: ce(1501),
      title: "Ismail I founds the Safavid dynasty in Iran",
      detail: "Crowned shah at Tabriz, Ismail made Twelver Shia Islam the state religion, setting Iran on a path distinct from its Sunni Ottoman and Uzbek neighbors and shaping the country to this day.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Ismail_I'
    },
    {
      t: ce(1503),
      title: "Leonardo da Vinci begins the Mona Lisa",
      detail: "Leonardo started his portrait of Lisa Gherardini in Florence and kept refining it until his death in France, where it entered the royal collection and became the world's most famous painting.",
      tier: 5, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Mona_Lisa'
    },
    {
      t: ce(1508), end: ce(1512, 11, 1),
      title: "Michelangelo paints the Sistine Chapel ceiling",
      detail: "Commissioned by Pope Julius II, Michelangelo spent four years on scaffolding painting some 300 figures, including the Creation of Adam; the ceiling was unveiled on All Saints' Day 1512 and is a summit of Renaissance art.",
      tier: 4, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Sistine_Chapel_ceiling'
    },
    {
      t: ce(1511, 8, 24),
      title: "Afonso de Albuquerque captures Malacca for Portugal",
      detail: "The Portuguese seized the sultanate that controlled the strait between the Indian Ocean and the South China Sea, giving Europe its first foothold in the spice trade of Southeast Asia.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Capture_of_Malacca_(1511)'
    },
    {
      t: ce(1517, 10, 31),
      title: "Martin Luther posts the Ninety-five Theses",
      detail: "Luther's attack on the sale of indulgences, circulated from Wittenberg, launched the Protestant Reformation that split Western Christianity and redrew the politics of Europe.",
      tier: 1, category: 'religion',
      link: 'https://en.wikipedia.org/wiki/Ninety-five_Theses'
    },
    {
      t: ce(1519, 9, 20), end: ce(1522, 9, 6),
      title: "Magellan–Elcano expedition makes the first circumnavigation of the globe",
      detail: "Five ships left Spain under Ferdinand Magellan; after his death in the Philippines, Juan Sebastián Elcano brought the Victoria home with 18 survivors, proving the world's oceans were one connected sea.",
      tier: 3, category: 'exploration',
      link: 'https://en.wikipedia.org/wiki/Magellan_expedition'
    },
    {
      t: ce(1520, 9, 30), end: ce(1566, 9, 6),
      title: "Suleiman the Magnificent rules the Ottoman Empire at its height",
      detail: "Suleiman took Belgrade, Rhodes and most of Hungary, besieged Vienna in 1529, and codified Ottoman law while his fleets dominated the Mediterranean.",
      tier: 4, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Suleiman_the_Magnificent'
    },
    {
      t: ce(1521, 8, 13),
      title: "Cortés captures Tenochtitlan and the Aztec Empire falls",
      detail: "After a 93-day siege, Hernán Cortés and tens of thousands of Indigenous allies took the Aztec capital, opening the American mainland to Spanish rule and the catastrophic spread of Old World diseases.",
      tier: 1, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Fall_of_Tenochtitlan'
    },
    {
      t: ce(1524), end: ce(1525),
      title: "German Peasants' War, Europe's largest popular uprising before 1789",
      detail: "Peasants across the German lands rose against feudal dues and serfdom, citing Luther's gospel of freedom; Luther disowned them and the princes' armies killed as many as 100,000 rebels.",
      tier: 6, category: 'war',
      link: 'https://en.wikipedia.org/wiki/German_Peasants%27_War'
    },
    {
      t: ce(1526, 4, 21),
      title: "Babur wins at Panipat and founds the Mughal Empire",
      detail: "Babur's field guns and cavalry tactics destroyed the Delhi Sultanate's far larger army; his descendants would rule most of the Indian subcontinent for two centuries.",
      tier: 3, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/First_Battle_of_Panipat'
    },
    {
      t: ce(1532, 11, 16),
      title: "Pizarro seizes the Inca emperor Atahualpa at Cajamarca",
      detail: "With about 170 men, Francisco Pizarro ambushed Atahualpa, took a room filled with gold and silver as ransom, then executed him, bringing the Inca Empire under Spanish control.",
      tier: 4, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Battle_of_Cajamarca'
    },
    {
      t: ce(1534, 11, 3),
      title: "Act of Supremacy makes Henry VIII head of the Church of England",
      detail: "Parliament severed the English church from Rome after the pope refused to annul Henry's marriage to Catherine of Aragon, beginning the English Reformation and the dissolution of the monasteries.",
      tier: 4, category: 'religion',
      link: 'https://en.wikipedia.org/wiki/Acts_of_Supremacy'
    },
    {
      t: ce(1543), end: ce(1687),
      title: "Scientific Revolution",
      detail: "From Copernicus's heliocentric model to Newton's Principia, Kepler, Galileo, Harvey, Boyle and others replaced inherited authority with observation, experiment and mathematics, creating modern science.",
      tier: 2, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Scientific_Revolution'
    },
    {
      t: ce(1543),
      title: "Copernicus publishes On the Revolutions of the Heavenly Spheres",
      detail: "Nicolaus Copernicus placed the Sun, not the Earth, at the center of the cosmos, opening the Scientific Revolution that Kepler, Galileo and Newton would carry through.",
      tier: 1, category: 'science',
      link: 'https://en.wikipedia.org/wiki/De_revolutionibus_orbium_coelestium'
    },
    {
      t: ce(1543),
      title: "Vesalius publishes De humani corporis fabrica",
      detail: "Andreas Vesalius's lavishly illustrated anatomy, based on his own dissections of human bodies, corrected centuries of errors inherited from Galen and founded modern anatomy.",
      tier: 4, category: 'medicine',
      link: 'https://en.wikipedia.org/wiki/De_Humani_Corporis_Fabrica_Libri_Septem'
    },
    {
      t: ce(1543),
      title: "Portuguese traders reach Japan and introduce firearms",
      detail: "Portuguese sailors blown ashore on Tanegashima brought the first matchlock guns to Japan; local smiths copied them within a year, and the 'southern barbarian' trade in guns, silk and silver followed, along with Jesuit missionaries.",
      tier: 6, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Nanban_trade'
    },
    {
      t: ce(1545),
      title: "Silver discovered at Potosí in the Andes",
      detail: "The Cerro Rico of Potosí, in present-day Bolivia, became the richest silver mine in history and the largest city in the Americas; worked by forced Indigenous labor, its silver financed Spain's wars and flowed to China via Manila.",
      tier: 4, category: 'civilization',
      link: 'https://en.wikipedia.org/wiki/Potos%C3%AD'
    },
    {
      t: ce(1545, 12, 13), end: ce(1563, 12, 4),
      title: "Council of Trent shapes the Catholic Counter-Reformation",
      detail: "Meeting in three sessions over 18 years, the council reaffirmed Catholic doctrine against Protestant challenges and reformed clerical training, preaching and discipline.",
      tier: 5, category: 'religion',
      link: 'https://en.wikipedia.org/wiki/Council_of_Trent'
    },

    // ---- 1550–1600 ---------------------------------------------------------
    {
      t: ce(1556, 1, 23),
      title: "Shaanxi earthquake, the deadliest in recorded history",
      detail: "An earthquake in Ming China's Shaanxi province collapsed the loess cave dwellings in which much of the population lived, killing an estimated 830,000 people across a swath of central China.",
      tier: 5, category: 'civilization',
      link: 'https://en.wikipedia.org/wiki/1556_Shaanxi_earthquake'
    },
    {
      t: ce(1556, 2, 14), end: ce(1605, 10, 27),
      title: "Akbar the Great consolidates the Mughal Empire",
      detail: "Akbar tripled Mughal territory, abolished the tax on non-Muslims, built a centralized bureaucracy and pursued religious dialogue, making the empire the wealthiest state on Earth.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Akbar'
    },
    {
      t: ce(1558, 11, 17), end: ce(1603, 3, 24),
      title: "Reign of Elizabeth I of England",
      detail: "Elizabeth's 44-year reign settled the Protestant church, saw off the Spanish Armada, and presided over a flowering of English drama and the first ventures toward overseas empire.",
      tier: 4, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Elizabeth_I'
    },
    {
      t: ce(1562, 3, 1), end: ce(1598, 4, 13),
      title: "French Wars of Religion",
      detail: "From the massacre of Huguenots at Wassy to the Edict of Nantes, eight civil wars between Catholics and Protestants, including the St Bartholomew's Day massacre of 1572, killed as many as three million people in France.",
      tier: 5, category: 'war',
      link: 'https://en.wikipedia.org/wiki/French_Wars_of_Religion'
    },
    {
      t: ce(1565),
      title: "Manila galleons open regular trade across the Pacific",
      detail: "Andrés de Urdaneta found the eastward route from the Philippines to Mexico, and for 250 years Spanish galleons exchanged American silver for Asian silk and porcelain, closing the first global trade loop.",
      tier: 5, category: 'exploration',
      link: 'https://en.wikipedia.org/wiki/Manila_galleon'
    },
    {
      t: ce(1570),
      title: "Potatoes from the Andes reach Europe",
      detail: "Brought by Spanish ships around 1570, the potato was slow to catch on but became a staple that fed Europe's population boom, the most consequential crop of the Columbian exchange after maize.",
      tier: 5, category: 'agriculture',
      link: 'https://en.wikipedia.org/wiki/History_of_the_potato'
    },
    {
      t: ce(1582, 10, 15),
      title: "Gregorian calendar introduced by Pope Gregory XIII",
      detail: "To realign the calendar with the seasons, ten days were dropped so that 4 October was followed by 15 October, and the leap-year rule was refined; it is now the world's civil calendar.",
      tier: 4, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Gregorian_calendar'
    },
    {
      t: ce(1588, 8, 8),
      title: "English fleet defeats the Spanish Armada",
      detail: "Fireships and the Battle of Gravelines scattered Philip II's invasion fleet, which storms then wrecked around Scotland and Ireland, securing Protestant England and boosting its naval ambitions.",
      tier: 4, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Spanish_Armada'
    },
    {
      t: ce(1590), end: ce(1613),
      title: "Shakespeare writes his plays, from Henry VI to The Tempest",
      detail: "William Shakespeare wrote some 37 plays and 154 sonnets for the London stage, including Hamlet, Macbeth and King Lear, and became the most performed dramatist in any language.",
      tier: 3, category: 'art',
      link: 'https://en.wikipedia.org/wiki/William_Shakespeare'
    },
    {
      t: ce(1591, 3, 13),
      title: "Moroccan army destroys the Songhai Empire at Tondibi",
      detail: "A Moroccan force of a few thousand musketeers under Judar Pasha crossed the Sahara and routed the far larger Songhai army near Gao; Timbuktu and Gao fell, ending the last of the great West African empires.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Battle_of_Tondibi'
    },
    {
      t: ce(1592, 5, 23), end: ce(1598, 12, 16),
      title: "Japanese invasions of Korea (Imjin War)",
      detail: "Toyotomi Hideyoshi sent some 150,000 troops to conquer Korea as a step toward China; Admiral Yi Sun-sin's fleet and Ming Chinese armies wore them down, and Japan withdrew after Hideyoshi's death, leaving Korea devastated.",
      tier: 5, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Japanese_invasions_of_Korea_(1592%E2%80%931598)'
    },

    // ---- 1600–1650 ---------------------------------------------------------
    {
      t: ce(1600, 12, 31),
      title: "English East India Company chartered by Elizabeth I",
      detail: "The royal charter granted London merchants a monopoly on English trade east of the Cape of Good Hope; the company would go on to conquer and rule most of India until the Crown took over in 1858.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/East_India_Company'
    },
    {
      t: ce(1602, 3, 20),
      title: "Dutch East India Company (VOC) is chartered",
      detail: "The VOC received a monopoly on Dutch trade with Asia and became the first company to sell shares to the public, building a trading empire from Batavia to Nagasaki.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Dutch_East_India_Company'
    },
    {
      t: ce(1603, 3, 24),
      title: "Tokugawa Ieyasu becomes shogun, unifying Japan under Tokugawa rule",
      detail: "After his victory at Sekigahara in 1600, Ieyasu founded a shogunate at Edo that kept Japan at peace and largely closed to the outside world for more than 250 years.",
      tier: 3, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Tokugawa_Ieyasu'
    },
    {
      t: ce(1605, 1),
      title: "Cervantes publishes Don Quixote",
      detail: "The first part of Miguel de Cervantes's tale of a deluded knight and his squire Sancho Panza appeared in Madrid, with a second part in 1615; it is widely regarded as the first modern novel.",
      tier: 4, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Don_Quixote'
    },
    {
      t: ce(1607, 5, 14),
      title: "Jamestown founded, the first permanent English settlement in America",
      detail: "Virginia Company colonists landed on the James River; despite starvation and war with the Powhatan, tobacco made the colony pay and began English North America.",
      tier: 4, category: 'migration',
      link: 'https://en.wikipedia.org/wiki/Jamestown,_Virginia'
    },
    {
      t: ce(1609),
      title: "Kepler publishes his first two laws of planetary motion",
      detail: "In Astronomia Nova, Johannes Kepler showed from Tycho Brahe's data that Mars moves in an ellipse and sweeps equal areas in equal times, discarding the ancient dogma of circular orbits.",
      tier: 4, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Astronomia_nova'
    },
    {
      t: ce(1610, 3, 13),
      title: "Galileo publishes Sidereus Nuncius, his telescope discoveries",
      detail: "Galileo Galilei reported mountains on the Moon, countless stars in the Milky Way and four moons circling Jupiter, the first observational blows against the Earth-centered cosmos.",
      tier: 3, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Sidereus_Nuncius'
    },
    {
      t: ce(1618, 5, 23), end: ce(1648, 10, 24),
      title: "Thirty Years' War devastates central Europe",
      detail: "Begun with the Defenestration of Prague, the religious and dynastic war killed perhaps a third of the population of the German lands; the Peace of Westphalia set up the modern system of sovereign states.",
      tier: 3, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Thirty_Years%27_War'
    },
    {
      t: ce(1620, 11, 11),
      title: "Pilgrims aboard the Mayflower sign the Mayflower Compact",
      detail: "Anchored off Cape Cod, the Separatist settlers agreed to govern themselves by majority rule before founding Plymouth Colony, an early precedent for American self-government.",
      tier: 6, category: 'migration',
      link: 'https://en.wikipedia.org/wiki/Mayflower_Compact'
    },
    {
      t: ce(1628),
      title: "William Harvey demonstrates the circulation of the blood",
      detail: "In De Motu Cordis, Harvey showed by experiment and measurement that the heart pumps blood around the body in a closed circuit, overturning Galen's physiology.",
      tier: 5, category: 'medicine',
      link: 'https://en.wikipedia.org/wiki/William_Harvey'
    },
    {
      t: ce(1632), end: ce(1653),
      title: "Shah Jahan builds the Taj Mahal at Agra",
      detail: "The white-marble mausoleum for his wife Mumtaz Mahal occupied some 20,000 workers for two decades and is the supreme monument of Mughal architecture.",
      tier: 4, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Taj_Mahal'
    },
    {
      t: ce(1633, 6, 22),
      title: "Galileo is condemned by the Inquisition and forced to recant",
      detail: "Tried in Rome for defending the Copernican system in his Dialogue, Galileo abjured heliocentrism and spent his remaining years under house arrest, a lasting symbol of the clash between science and authority.",
      tier: 6, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Galileo_affair'
    },
    {
      t: ce(1637, 6, 8),
      title: "Descartes publishes the Discourse on the Method",
      detail: "René Descartes set out a method of systematic doubt, concluding 'I think, therefore I am'; an appendix, La Géométrie, introduced the coordinate system that united algebra and geometry.",
      tier: 4, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Discourse_on_the_Method'
    },
    {
      t: ce(1642),
      title: "Blaise Pascal builds the Pascaline mechanical calculator",
      detail: "Nineteen-year-old Pascal designed a geared machine that could add and subtract to help with his father's tax work, one of the first working mechanical calculators.",
      tier: 6, category: 'computing',
      link: 'https://en.wikipedia.org/wiki/Pascaline'
    },
    {
      t: ce(1642, 8, 22), end: ce(1651, 9, 3),
      title: "English Civil War between King and Parliament",
      detail: "Parliament's New Model Army defeated Charles I, who was tried and beheaded in January 1649; England became a republic under Oliver Cromwell until the monarchy returned in 1660.",
      tier: 4, category: 'war',
      link: 'https://en.wikipedia.org/wiki/English_Civil_War'
    },
    {
      t: ce(1642, 11, 24),
      title: "Abel Tasman sights Tasmania, then New Zealand",
      detail: "Sailing for the Dutch East India Company, Tasman was the first European to reach Van Diemen's Land and, on 13 December, the South Island of New Zealand, where a clash with Māori at Golden Bay killed four of his crew.",
      tier: 6, category: 'exploration',
      link: 'https://en.wikipedia.org/wiki/Abel_Tasman'
    },
    {
      t: ce(1644, 6, 6),
      title: "Manchu armies take Beijing and establish Qing rule over China",
      detail: "After the Ming dynasty collapsed in a peasant rebellion, the Manchu Qing entered Beijing; their dynasty would rule China until 1912 and expand it to its greatest extent.",
      tier: 3, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Transition_from_Ming_to_Qing'
    },

    // ---- 1650–1700 ---------------------------------------------------------
    {
      t: ce(1651),
      title: "Hobbes publishes Leviathan",
      detail: "Written in exile during the English Civil War, Thomas Hobbes's Leviathan argued that people escape a brutish state of nature only by submitting to an absolute sovereign, founding modern political philosophy.",
      tier: 6, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Leviathan_(Hobbes_book)'
    },
    {
      t: ce(1652, 4, 6),
      title: "Dutch East India Company founds Cape Town",
      detail: "Jan van Riebeeck landed at Table Bay to build a station supplying VOC ships with fresh food and water; the settlement grew into the Cape Colony, the beginning of European settlement in South Africa.",
      tier: 5, category: 'migration',
      link: 'https://en.wikipedia.org/wiki/Dutch_Cape_Colony'
    },
    {
      t: ce(1660, 11, 28),
      title: "Royal Society founded in London to promote experimental science",
      detail: "Twelve men including Christopher Wren and Robert Boyle met at Gresham College to found a society for experimental learning; chartered by Charles II in 1662, it went on to publish Newton's Principia and remains the oldest scientific academy in continuous existence.",
      tier: 5, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Royal_Society'
    },
    {
      t: ce(1661, 2, 5), end: ce(1722, 12, 20),
      title: "Kangxi Emperor reigns over Qing China",
      detail: "The longest-reigning emperor in Chinese history crushed the Three Feudatories revolt, took Taiwan, fixed the border with Russia, and patronized scholarship and Jesuit science.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Kangxi_Emperor'
    },
    {
      t: ce(1661, 3, 10), end: ce(1715, 9, 1),
      title: "Louis XIV rules France in person as the Sun King",
      detail: "After Cardinal Mazarin's death Louis governed without a chief minister for 54 years, moving his court to Versailles in 1682, revoking the Edict of Nantes in 1685, and fighting wars that made France Europe's dominant power while draining its treasury.",
      tier: 4, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Louis_XIV'
    },
    {
      t: ce(1662, 2, 1),
      title: "Koxinga expels the Dutch from Taiwan",
      detail: "After a nine-month siege, the Ming loyalist Zheng Chenggong (Koxinga) took Fort Zeelandia from the Dutch East India Company and founded a Chinese kingdom on Taiwan that held out against the Qing until 1683.",
      tier: 6, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Siege_of_Fort_Zeelandia'
    },
    {
      t: ce(1674, 6, 6),
      title: "Shivaji crowned Chhatrapati, founding the Maratha Empire",
      detail: "Crowned at Raigad after decades of guerrilla war against the Bijapur sultanate and the Mughals, Shivaji created a Hindu state in western India whose Maratha successors dominated the subcontinent in the 18th century.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Shivaji'
    },
    {
      t: ce(1676, 10, 9),
      title: "Leeuwenhoek reports the first observations of bacteria",
      detail: "Using single-lens microscopes he ground himself, Antonie van Leeuwenhoek described tiny 'animalcules' in rainwater and pepper-water infusions (and, in 1683, in scrapings from his own teeth), opening the microbial world to science.",
      tier: 5, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Antonie_van_Leeuwenhoek'
    },
    {
      t: ce(1682, 5, 7), end: ce(1725, 2, 8),
      title: "Peter the Great modernizes Russia",
      detail: "Peter built a navy, remade the army and administration on Western lines, defeated Sweden in the Great Northern War, and founded St Petersburg in 1703, making it his capital on the Baltic in 1712.",
      tier: 4, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Peter_the_Great'
    },
    {
      t: ce(1683, 7, 14), end: ce(1683, 9, 12),
      title: "Ottoman siege of Vienna broken by John III Sobieski's relief army",
      detail: "Two months after Kara Mustafa's army encircled the Habsburg capital, a Polish and Imperial force under King John III Sobieski charged down from the Kahlenberg and routed the besiegers; the Ottomans never again threatened central Europe and lost Hungary by 1699.",
      tier: 5, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Battle_of_Vienna'
    },
    {
      t: ce(1687, 7, 5),
      title: "Newton publishes the Principia, laying down the laws of motion and gravity",
      detail: "Isaac Newton's three laws of motion and law of universal gravitation explained falling apples and orbiting planets with the same mathematics, the foundation of physics for two centuries.",
      tier: 0, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Philosophi%C3%A6_Naturalis_Principia_Mathematica'
    },
    {
      t: ce(1688, 11, 5),
      title: "Glorious Revolution: William of Orange lands in England",
      detail: "James II fled and Parliament offered the crown to William and Mary on the terms of the 1689 Bill of Rights, establishing parliamentary supremacy over the monarchy.",
      tier: 3, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Glorious_Revolution'
    },

    // ---- 1700–1750 ---------------------------------------------------------
    {
      t: ce(1700), end: ce(1800),
      title: "Transatlantic slave trade reaches its peak",
      detail: "European ships carried more than six million enslaved Africans across the Atlantic during the 18th century, the largest forced migration in history, to work the plantations of the Americas.",
      tier: 2, category: 'migration',
      link: 'https://en.wikipedia.org/wiki/Atlantic_slave_trade'
    },
    {
      t: ce(1700), end: ce(1800),
      title: "British Agricultural Revolution raises farm yields",
      detail: "Enclosure, four-course crop rotation, the seed drill and selective breeding roughly doubled output per farmer, feeding growing cities and freeing labor for industry.",
      tier: 5, category: 'agriculture',
      link: 'https://en.wikipedia.org/wiki/British_Agricultural_Revolution'
    },
    {
      t: ce(1701),
      title: "Osei Tutu founds the Ashanti Empire",
      detail: "Uniting the Akan states around Kumasi under the sacred Golden Stool and defeating their overlord Denkyira, Osei Tutu created a gold-rich empire that dominated the forests of present-day Ghana for two centuries.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Ashanti_Empire'
    },
    {
      t: ce(1707, 3, 3),
      title: "Death of Aurangzeb begins the decline of the Mughal Empire",
      detail: "The last great Mughal emperor died at 88 after a 49-year reign that had stretched the empire to its widest extent but exhausted it in wars against the Marathas; succession struggles and regional breakaways followed.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Aurangzeb'
    },
    {
      t: ce(1707, 5, 1),
      title: "Acts of Union join England and Scotland as Great Britain",
      detail: "The two parliaments merged into one at Westminster, creating the Kingdom of Great Britain with a single crown, currency and free trade across the island.",
      tier: 5, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Acts_of_Union_1707'
    },
    {
      t: ce(1712),
      title: "Newcomen builds the first practical steam engine",
      detail: "Thomas Newcomen's atmospheric engine pumped water from a coal mine near Dudley, the first machine to turn heat into useful mechanical work on a large scale.",
      tier: 5, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Newcomen_atmospheric_engine'
    },
    {
      t: ce(1721, 3, 24),
      title: "J. S. Bach dedicates the Brandenburg Concertos",
      detail: "Johann Sebastian Bach presented six concertos to the Margrave of Brandenburg, a summit of Baroque music; as cantor of St Thomas's in Leipzig from 1723 he went on to write the St Matthew Passion and the Mass in B minor.",
      tier: 5, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Brandenburg_Concertos'
    },
    {
      t: ce(1721, 4),
      title: "Lady Mary Wortley Montagu brings smallpox inoculation to Britain",
      detail: "Having seen variolation practised in Constantinople, Montagu had her daughter inoculated during a London epidemic; the method spread through Europe and America decades before Jenner's safer vaccine.",
      tier: 6, category: 'medicine',
      link: 'https://en.wikipedia.org/wiki/Lady_Mary_Wortley_Montagu'
    },
    {
      t: ce(1735),
      title: "Linnaeus publishes Systema Naturae",
      detail: "Carl Linnaeus's scheme for classifying living things by kingdom, class, order, genus and species, with two-part Latin names, became the basis of biological taxonomy.",
      tier: 5, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Systema_Naturae'
    },
    {
      t: ce(1735, 10, 18), end: ce(1796, 2, 9),
      title: "Qianlong Emperor reigns as Qing China reaches its greatest extent",
      detail: "Qianlong's campaigns conquered Xinjiang and tightened Qing control over Tibet, and China's population passed 300 million, but corruption late in his reign foreshadowed the dynasty's decline.",
      tier: 5, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Qianlong_Emperor'
    },
    {
      t: ce(1739, 2, 24),
      title: "Nader Shah defeats the Mughals at Karnal and sacks Delhi",
      detail: "The Persian conqueror crushed a Mughal army many times larger, then plundered Delhi, carrying off the Peacock Throne and the Koh-i-Noor diamond and leaving the Mughal Empire a hollow shell.",
      tier: 6, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Nader_Shah%27s_invasion_of_the_Mughal_Empire'
    },
    {
      t: ce(1742, 4, 13),
      title: "Handel's Messiah premieres in Dublin",
      detail: "George Frideric Handel conducted the first performance of his oratorio at the Great Music Hall on Fishamble Street as a charity benefit; with its Hallelujah chorus it became the most performed choral work in English.",
      tier: 6, category: 'art',
      link: 'https://en.wikipedia.org/wiki/Messiah_(Handel)'
    },
    {
      t: ce(1744),
      title: "Ibn Saud and Ibn Abd al-Wahhab form the pact that founds the first Saudi state",
      detail: "The emir of Diriyah, Muhammad ibn Saud, allied with the reformer Muhammad ibn Abd al-Wahhab, joining political power to a puritanical Islam; the pact underlies the Saudi state and the Wahhabi movement to this day.",
      tier: 6, category: 'religion',
      link: 'https://en.wikipedia.org/wiki/Emirate_of_Diriyah'
    },

    // ---- 1750–1800 ---------------------------------------------------------
    {
      t: ce(1751), end: ce(1772),
      title: "Diderot and d'Alembert publish the Encyclopédie",
      detail: "The 28-volume Encyclopédie, with articles by Voltaire, Rousseau and Montesquieu, gathered the knowledge of the age in a spirit of secular reason and became the flagship of the Enlightenment.",
      tier: 3, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Encyclop%C3%A9die'
    },
    {
      t: ce(1755, 11, 1),
      title: "Lisbon earthquake and tsunami destroy the Portuguese capital",
      detail: "On All Saints' Day an earthquake, tsunami and fires killed tens of thousands and leveled Lisbon; the disaster shook Enlightenment optimism and prompted the first modern earthquake surveys.",
      tier: 5, category: 'civilization',
      link: 'https://en.wikipedia.org/wiki/1755_Lisbon_earthquake'
    },
    {
      t: ce(1756, 5, 17), end: ce(1763, 2, 15),
      title: "Seven Years' War, the first global conflict",
      detail: "Fought in Europe, North America, India, West Africa and on every ocean, the war left Britain the dominant colonial power, France stripped of Canada, and both crowns deep in debt.",
      tier: 3, category: 'war',
      link: 'https://en.wikipedia.org/wiki/Seven_Years%27_War'
    },
    {
      t: ce(1757, 6, 23),
      title: "Battle of Plassey begins British East India Company rule in Bengal",
      detail: "Robert Clive's victory over the Nawab of Bengal, secured by bribing the Nawab's commander, gave the East India Company control of India's richest province and opened two centuries of British rule.",
      tier: 4, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Battle_of_Plassey'
    },
    {
      t: ce(1760), end: ce(1840),
      title: "Industrial Revolution",
      detail: "From about 1760 Britain moved from hand production to coal, steam, machines and factories, and railways followed; sustained growth in output and population then spread to Europe and North America, the deepest change in how people live since farming began.",
      tier: 0, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Industrial_Revolution'
    },
    {
      t: ce(1761, 11, 18), end: ce(1762, 1, 19),
      title: "Harrison's H4 chronometer proves itself on a voyage to Jamaica",
      detail: "John Harrison's watch lost only about five seconds on the 81-day passage of HMS Deptford, showing that a mechanical clock could fix longitude at sea, the problem that had wrecked fleets for centuries.",
      tier: 5, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/John_Harrison'
    },
    {
      t: ce(1762, 4),
      title: "Rousseau publishes The Social Contract",
      detail: "Opening with 'Man is born free, and everywhere he is in chains', Jean-Jacques Rousseau argued that legitimate authority rests on the general will of the people, a text the French revolutionaries would treat as scripture.",
      tier: 5, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/The_Social_Contract'
    },
    {
      t: ce(1762, 7, 9), end: ce(1796, 11, 17),
      title: "Catherine the Great reigns over Russia",
      detail: "Seizing the throne from her husband Peter III, Catherine expanded Russia to the Black Sea and Crimea, took the lion's share of partitioned Poland, corresponded with Voltaire and founded the Hermitage collection.",
      tier: 4, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Catherine_the_Great'
    },
    {
      t: ce(1768, 8, 26), end: ce(1779, 2, 14),
      title: "Captain Cook's Pacific voyages chart New Zealand, Australia and Hawaii",
      detail: "James Cook's three voyages mapped the Pacific with unprecedented accuracy, proved the marine chronometer at sea, and ended with his death in Hawaii on 14 February 1779.",
      tier: 4, category: 'exploration',
      link: 'https://en.wikipedia.org/wiki/James_Cook'
    },
    {
      t: ce(1769, 1, 5),
      title: "James Watt patents his improved steam engine",
      detail: "Watt's separate condenser cut fuel use by three-quarters; his engines, built with Matthew Boulton from 1775, powered mills, mines and later locomotives, driving the Industrial Revolution.",
      tier: 2, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Watt_steam_engine'
    },
    {
      t: ce(1775, 4, 19), end: ce(1783, 9, 3),
      title: "American Revolutionary War",
      detail: "From the first shots at Lexington and Concord to the Treaty of Paris, thirteen British colonies, aided by France after 1778, won their independence, sealed by the surrender at Yorktown in 1781.",
      tier: 4, category: 'war',
      link: 'https://en.wikipedia.org/wiki/American_Revolutionary_War'
    },
    {
      t: ce(1776, 3, 9),
      title: "Adam Smith publishes The Wealth of Nations",
      detail: "Smith's analysis of the division of labor, free markets and the 'invisible hand' founded modern economics and argued against mercantilist restrictions on trade.",
      tier: 3, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/The_Wealth_of_Nations'
    },
    {
      t: ce(1776, 7, 4),
      title: "United States Declaration of Independence adopted",
      detail: "The Continental Congress declared the thirteen colonies free of British rule, asserting that all men are created equal with unalienable rights to life, liberty and the pursuit of happiness.",
      tier: 2, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence'
    },
    {
      t: ce(1780, 11, 4), end: ce(1781, 5, 18),
      title: "Túpac Amaru II leads an Indigenous uprising against Spanish rule in Peru",
      detail: "Claiming descent from the last Inca, José Gabriel Condorcanqui executed a Spanish governor and raised tens of thousands of Andean rebels; he was captured and torn apart in Cuzco, but the revolt shook colonial rule across the Andes.",
      tier: 6, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Rebellion_of_T%C3%BApac_Amaru_II'
    },
    {
      t: ce(1781, 3, 13),
      title: "William Herschel discovers Uranus",
      detail: "Observing from his garden in Bath with a telescope he built himself, Herschel found the first planet unknown to the ancients, doubling the size of the known solar system overnight.",
      tier: 6, category: 'space',
      link: 'https://en.wikipedia.org/wiki/William_Herschel'
    },
    {
      t: ce(1782, 4, 6),
      title: "Rama I founds the Chakri dynasty and makes Bangkok the capital of Siam",
      detail: "After the fall of Ayutthaya to Burma in 1767 and the reign of Taksin, the general Chao Phraya Chakri took the throne and built a new capital on the Chao Phraya River; his dynasty still reigns in Thailand.",
      tier: 6, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Rama_I'
    },
    {
      t: ce(1783, 6, 8), end: ce(1784, 2, 7),
      title: "Laki fissure eruption in Iceland poisons the air of Europe",
      detail: "Eight months of eruptions released vast clouds of fluorine and sulphur dioxide that killed most of Iceland's livestock and a fifth of its people, and spread a deadly haze and freak weather across Europe.",
      tier: 6, category: 'civilization',
      link: 'https://en.wikipedia.org/wiki/Laki'
    },
    {
      t: ce(1783, 11, 21),
      title: "First human flight: a Montgolfier balloon carries two men over Paris",
      detail: "Pilâtre de Rozier and the Marquis d'Arlandes drifted about nine kilometers in a hot-air balloon built by the Montgolfier brothers, the first untethered flight by human beings.",
      tier: 6, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Montgolfier_brothers'
    },
    {
      t: ce(1787, 9, 17),
      title: "United States Constitution signed in Philadelphia",
      detail: "Delegates created a federal republic with separated powers and checks and balances; ratified in 1788, it remains the oldest written national constitution still in force.",
      tier: 3, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Constitution_of_the_United_States'
    },
    {
      t: ce(1788, 1, 26),
      title: "First Fleet lands at Sydney Cove, founding British Australia",
      detail: "Eleven ships carrying about 750 convicts with their guards established the penal colony of New South Wales, beginning European settlement and the dispossession of Aboriginal peoples.",
      tier: 5, category: 'migration',
      link: 'https://en.wikipedia.org/wiki/First_Fleet'
    },
    {
      t: ce(1789),
      title: "Lavoisier publishes the Elementary Treatise on Chemistry",
      detail: "Antoine Lavoisier's textbook set out the conservation of mass, the role of oxygen in combustion and a systematic chemical nomenclature, founding modern chemistry.",
      tier: 4, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Trait%C3%A9_%C3%A9l%C3%A9mentaire_de_chimie'
    },
    {
      t: ce(1789, 7, 14),
      title: "Storming of the Bastille begins the French Revolution",
      detail: "A Paris crowd seized the royal fortress weeks after the Third Estate proclaimed a National Assembly; the revolution abolished feudal privilege, executed the king and convulsed Europe for 25 years.",
      tier: 1, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Storming_of_the_Bastille'
    },
    {
      t: ce(1791, 8, 22),
      title: "Enslaved people rise in Saint-Domingue, starting the Haitian Revolution",
      detail: "The uprising in France's richest colony, later led by Toussaint Louverture, became the only slave revolt to found a state when Haiti declared independence in 1804.",
      tier: 3, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Haitian_Revolution'
    },
    {
      t: ce(1791, 9, 30),
      title: "Mozart's The Magic Flute premieres in Vienna",
      detail: "Wolfgang Amadeus Mozart conducted the premiere of his last opera ten weeks before his death at 35, leaving the Requiem unfinished and more than 600 works behind.",
      tier: 5, category: 'art',
      link: 'https://en.wikipedia.org/wiki/The_Magic_Flute'
    },
    {
      t: ce(1792, 1),
      title: "Mary Wollstonecraft publishes A Vindication of the Rights of Woman",
      detail: "Answering those who would deny girls a serious education, Wollstonecraft argued that women appear inferior only because they are kept ignorant, a founding text of feminism.",
      tier: 5, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/A_Vindication_of_the_Rights_of_Woman'
    },
    {
      t: ce(1794, 3, 14),
      title: "Eli Whitney patents the cotton gin",
      detail: "Whitney's machine separated seeds from short-staple cotton fifty times faster than by hand; cotton became America's leading export and slavery, which had seemed to be waning, expanded across the Deep South.",
      tier: 5, category: 'technology',
      link: 'https://en.wikipedia.org/wiki/Cotton_gin'
    },
    {
      t: ce(1795, 5),
      title: "Kamehameha wins the Battle of Nuʻuanu and unites most of Hawaii",
      detail: "Driving the Oʻahu army over the Nuʻuanu Pali cliffs, Kamehameha added Oʻahu to Hawaiʻi, Maui and Molokaʻi; with Kauaʻi's submission in 1810 he ruled the first unified Hawaiian Kingdom.",
      tier: 6, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Kamehameha_I'
    },
    {
      t: ce(1796),
      title: "Agha Mohammad Khan founds the Qajar dynasty in Iran",
      detail: "The eunuch warlord who had reunited Iran after decades of chaos was crowned shah and made Tehran his capital; the Qajars ruled until 1925, losing the Caucasus to Russia along the way.",
      tier: 6, category: 'empire',
      link: 'https://en.wikipedia.org/wiki/Qajar_Iran'
    },
    {
      t: ce(1796, 5, 14),
      title: "Edward Jenner performs the first smallpox vaccination",
      detail: "Jenner inoculated eight-year-old James Phipps with cowpox and showed it protected him from smallpox, founding immunology and starting the road to the disease's eradication in 1980.",
      tier: 3, category: 'medicine',
      link: 'https://en.wikipedia.org/wiki/Edward_Jenner'
    },
    {
      t: ce(1799, 7, 15),
      title: "Rosetta Stone discovered by French soldiers in Egypt",
      detail: "Troops of Napoleon's expedition rebuilding a fort near Rashid found a slab inscribed with the same decree in hieroglyphs, Demotic and Greek; it let Jean-François Champollion decipher Egyptian hieroglyphs in 1822.",
      tier: 5, category: 'science',
      link: 'https://en.wikipedia.org/wiki/Rosetta_Stone'
    },
    {
      t: ce(1799, 11, 9),
      title: "Napoleon seizes power in the coup of 18 Brumaire",
      detail: "Napoleon Bonaparte overthrew the Directory and made himself First Consul, closing the French Revolution's decade of upheaval and beginning his domination of Europe.",
      tier: 6, category: 'politics',
      link: 'https://en.wikipedia.org/wiki/Coup_of_18_Brumaire'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
