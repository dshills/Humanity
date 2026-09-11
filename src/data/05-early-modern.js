/* HT.events — Early modern era, 1500–1800 (CONTRACT.md §6)
 *
 * Tier is the coarsest view at which the event appears, judged against all of
 * human history (CONTRACT.md §3). Dates are the commonly cited values; day
 * precision is used wherever the exact date is well established, ranges for
 * reigns, wars and other periods.
 */
(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});
  const { bce, ce, ymd, ya } = HT.time;
  HT.events = HT.events || [];
  HT.events.push(
    // ---- 1500–1550 ---------------------------------------------------------
    {
      t: ce(1501),
      title: "Ismail I founds the Safavid dynasty in Iran",
      detail: "Crowned shah at Tabriz, Ismail made Twelver Shia Islam the state religion, setting Iran on a path distinct from its Sunni Ottoman and Uzbek neighbors and shaping the country to this day.",
      tier: 5, category: 'empire'
    },
    {
      t: ce(1503),
      title: "Leonardo da Vinci begins the Mona Lisa",
      detail: "Leonardo started his portrait of Lisa Gherardini in Florence and kept refining it until his death in France, where it entered the royal collection and became the world's most famous painting.",
      tier: 5, category: 'art'
    },
    {
      t: ce(1517, 10, 31),
      title: "Martin Luther posts the Ninety-five Theses",
      detail: "Luther's attack on the sale of indulgences, circulated from Wittenberg, launched the Protestant Reformation that split Western Christianity and redrew the politics of Europe.",
      tier: 1, category: 'religion'
    },
    {
      t: ce(1519, 9, 20), end: ce(1522, 9, 6),
      title: "Magellan–Elcano expedition makes the first circumnavigation of the globe",
      detail: "Five ships left Spain under Ferdinand Magellan; after his death in the Philippines, Juan Sebastián Elcano brought the Victoria home with 18 survivors, proving the world's oceans were one connected sea.",
      tier: 3, category: 'exploration'
    },
    {
      t: ce(1520, 9, 30), end: ce(1566, 9, 6),
      title: "Suleiman the Magnificent rules the Ottoman Empire at its height",
      detail: "Suleiman took Belgrade, Rhodes and most of Hungary, besieged Vienna in 1529, and codified Ottoman law while his fleets dominated the Mediterranean.",
      tier: 4, category: 'empire'
    },
    {
      t: ce(1521, 8, 13),
      title: "Cortés captures Tenochtitlan and the Aztec Empire falls",
      detail: "After a 93-day siege, Hernán Cortés and tens of thousands of Indigenous allies took the Aztec capital, opening the American mainland to Spanish rule and the catastrophic spread of Old World diseases.",
      tier: 1, category: 'empire'
    },
    {
      t: ce(1526, 4, 21),
      title: "Babur wins at Panipat and founds the Mughal Empire",
      detail: "Babur's field guns and cavalry tactics destroyed the Delhi Sultanate's far larger army; his descendants would rule most of the Indian subcontinent for two centuries.",
      tier: 3, category: 'empire'
    },
    {
      t: ce(1532, 11, 16),
      title: "Pizarro seizes the Inca emperor Atahualpa at Cajamarca",
      detail: "With about 170 men, Francisco Pizarro ambushed Atahualpa, took a room filled with gold and silver as ransom, then executed him, bringing the Inca Empire under Spanish control.",
      tier: 4, category: 'empire'
    },
    {
      t: ce(1534, 11, 3),
      title: "Act of Supremacy makes Henry VIII head of the Church of England",
      detail: "Parliament severed the English church from Rome after the pope refused to annul Henry's marriage to Catherine of Aragon, beginning the English Reformation and the dissolution of the monasteries.",
      tier: 4, category: 'religion'
    },
    {
      t: ce(1543), end: ce(1687),
      title: "Scientific Revolution",
      detail: "From Copernicus's heliocentric model to Newton's Principia, Kepler, Galileo, Harvey, Boyle and others replaced inherited authority with observation, experiment and mathematics, creating modern science.",
      tier: 2, category: 'science'
    },
    {
      t: ce(1543),
      title: "Copernicus publishes On the Revolutions of the Heavenly Spheres",
      detail: "Nicolaus Copernicus placed the Sun, not the Earth, at the center of the cosmos, opening the Scientific Revolution that Kepler, Galileo and Newton would carry through.",
      tier: 1, category: 'science'
    },
    {
      t: ce(1543),
      title: "Vesalius publishes De humani corporis fabrica",
      detail: "Andreas Vesalius's lavishly illustrated anatomy, based on his own dissections of human bodies, corrected centuries of errors inherited from Galen and founded modern anatomy.",
      tier: 4, category: 'medicine'
    },
    {
      t: ce(1545, 12, 13), end: ce(1563, 12, 4),
      title: "Council of Trent shapes the Catholic Counter-Reformation",
      detail: "Meeting in three sessions over 18 years, the council reaffirmed Catholic doctrine against Protestant challenges and reformed clerical training, preaching and discipline.",
      tier: 5, category: 'religion'
    },

    // ---- 1550–1600 ---------------------------------------------------------
    {
      t: ce(1556, 2, 14), end: ce(1605, 10, 27),
      title: "Akbar the Great consolidates the Mughal Empire",
      detail: "Akbar tripled Mughal territory, abolished the tax on non-Muslims, built a centralized bureaucracy and pursued religious dialogue, making the empire the wealthiest state on Earth.",
      tier: 5, category: 'empire'
    },
    {
      t: ce(1558, 11, 17), end: ce(1603, 3, 24),
      title: "Reign of Elizabeth I of England",
      detail: "Elizabeth's 44-year reign settled the Protestant church, saw off the Spanish Armada, and presided over a flowering of English drama and the first ventures toward overseas empire.",
      tier: 4, category: 'politics'
    },
    {
      t: ce(1565),
      title: "Manila galleons open regular trade across the Pacific",
      detail: "Andrés de Urdaneta found the eastward route from the Philippines to Mexico, and for 250 years Spanish galleons exchanged American silver for Asian silk and porcelain, closing the first global trade loop.",
      tier: 5, category: 'exploration'
    },
    {
      t: ce(1570),
      title: "Potatoes from the Andes reach Europe",
      detail: "Brought by Spanish ships around 1570, the potato was slow to catch on but became a staple that fed Europe's population boom, the most consequential crop of the Columbian exchange after maize.",
      tier: 5, category: 'agriculture'
    },
    {
      t: ce(1582, 10, 15),
      title: "Gregorian calendar introduced by Pope Gregory XIII",
      detail: "To realign the calendar with the seasons, ten days were dropped so that 4 October was followed by 15 October, and the leap-year rule was refined; it is now the world's civil calendar.",
      tier: 4, category: 'science'
    },
    {
      t: ce(1588, 8, 8),
      title: "English fleet defeats the Spanish Armada",
      detail: "Fireships and the Battle of Gravelines scattered Philip II's invasion fleet, which storms then wrecked around Scotland and Ireland, securing Protestant England and boosting its naval ambitions.",
      tier: 4, category: 'war'
    },
    {
      t: ce(1590), end: ce(1613),
      title: "Shakespeare writes his plays, from Henry VI to The Tempest",
      detail: "William Shakespeare wrote some 37 plays and 154 sonnets for the London stage, including Hamlet, Macbeth and King Lear, and became the most performed dramatist in any language.",
      tier: 3, category: 'art'
    },

    // ---- 1600–1650 ---------------------------------------------------------
    {
      t: ce(1602, 3, 20),
      title: "Dutch East India Company (VOC) is chartered",
      detail: "The VOC received a monopoly on Dutch trade with Asia and became the first company to sell shares to the public, building a trading empire from Batavia to Nagasaki.",
      tier: 5, category: 'empire'
    },
    {
      t: ce(1603, 3, 24),
      title: "Tokugawa Ieyasu becomes shogun, unifying Japan under Tokugawa rule",
      detail: "After his victory at Sekigahara in 1600, Ieyasu founded a shogunate at Edo that kept Japan at peace and largely closed to the outside world for more than 250 years.",
      tier: 3, category: 'empire'
    },
    {
      t: ce(1607, 5, 14),
      title: "Jamestown founded, the first permanent English settlement in America",
      detail: "Virginia Company colonists landed on the James River; despite starvation and war with the Powhatan, tobacco made the colony pay and began English North America.",
      tier: 4, category: 'migration'
    },
    {
      t: ce(1609),
      title: "Kepler publishes his first two laws of planetary motion",
      detail: "In Astronomia Nova, Johannes Kepler showed from Tycho Brahe's data that Mars moves in an ellipse and sweeps equal areas in equal times, discarding the ancient dogma of circular orbits.",
      tier: 4, category: 'science'
    },
    {
      t: ce(1610, 3, 13),
      title: "Galileo publishes Sidereus Nuncius, his telescope discoveries",
      detail: "Galileo Galilei reported mountains on the Moon, countless stars in the Milky Way and four moons circling Jupiter, the first observational blows against the Earth-centered cosmos.",
      tier: 3, category: 'science'
    },
    {
      t: ce(1618, 5, 23), end: ce(1648, 10, 24),
      title: "Thirty Years' War devastates central Europe",
      detail: "Begun with the Defenestration of Prague, the religious and dynastic war killed perhaps a third of the population of the German lands; the Peace of Westphalia set up the modern system of sovereign states.",
      tier: 3, category: 'war'
    },
    {
      t: ce(1620, 11, 11),
      title: "Pilgrims aboard the Mayflower sign the Mayflower Compact",
      detail: "Anchored off Cape Cod, the Separatist settlers agreed to govern themselves by majority rule before founding Plymouth Colony, an early precedent for American self-government.",
      tier: 6, category: 'migration'
    },
    {
      t: ce(1628),
      title: "William Harvey demonstrates the circulation of the blood",
      detail: "In De Motu Cordis, Harvey showed by experiment and measurement that the heart pumps blood around the body in a closed circuit, overturning Galen's physiology.",
      tier: 5, category: 'medicine'
    },
    {
      t: ce(1632), end: ce(1653),
      title: "Shah Jahan builds the Taj Mahal at Agra",
      detail: "The white-marble mausoleum for his wife Mumtaz Mahal occupied some 20,000 workers for two decades and is the supreme monument of Mughal architecture.",
      tier: 4, category: 'art'
    },
    {
      t: ce(1633, 6, 22),
      title: "Galileo is condemned by the Inquisition and forced to recant",
      detail: "Tried in Rome for defending the Copernican system in his Dialogue, Galileo abjured heliocentrism and spent his remaining years under house arrest, a lasting symbol of the clash between science and authority.",
      tier: 6, category: 'science'
    },
    {
      t: ce(1642),
      title: "Blaise Pascal builds the Pascaline mechanical calculator",
      detail: "Nineteen-year-old Pascal designed a geared machine that could add and subtract to help with his father's tax work, one of the first working mechanical calculators.",
      tier: 6, category: 'computing'
    },
    {
      t: ce(1642, 8, 22), end: ce(1651, 9, 3),
      title: "English Civil War between King and Parliament",
      detail: "Parliament's New Model Army defeated Charles I, who was tried and beheaded in January 1649; England became a republic under Oliver Cromwell until the monarchy returned in 1660.",
      tier: 4, category: 'war'
    },
    {
      t: ce(1644, 6, 6),
      title: "Manchu armies take Beijing and establish Qing rule over China",
      detail: "After the Ming dynasty collapsed in a peasant rebellion, the Manchu Qing entered Beijing; their dynasty would rule China until 1912 and expand it to its greatest extent.",
      tier: 3, category: 'empire'
    },

    // ---- 1650–1700 ---------------------------------------------------------
    {
      t: ce(1651),
      title: "Hobbes publishes Leviathan",
      detail: "Written in exile during the English Civil War, Thomas Hobbes's Leviathan argued that people escape a brutish state of nature only by submitting to an absolute sovereign, founding modern political philosophy.",
      tier: 6, category: 'politics'
    },
    {
      t: ce(1660, 11, 28),
      title: "Royal Society founded in London to promote experimental science",
      detail: "Twelve men including Christopher Wren and Robert Boyle met at Gresham College to found a society for experimental learning; chartered by Charles II in 1662, it went on to publish Newton's Principia and remains the oldest scientific academy in continuous existence.",
      tier: 5, category: 'science'
    },
    {
      t: ce(1661, 2, 5), end: ce(1722, 12, 20),
      title: "Kangxi Emperor reigns over Qing China",
      detail: "The longest-reigning emperor in Chinese history crushed the Three Feudatories revolt, took Taiwan, fixed the border with Russia, and patronized scholarship and Jesuit science.",
      tier: 5, category: 'empire'
    },
    {
      t: ce(1661, 3, 10), end: ce(1715, 9, 1),
      title: "Louis XIV rules France in person as the Sun King",
      detail: "After Cardinal Mazarin's death Louis governed without a chief minister for 54 years, moving his court to Versailles in 1682, revoking the Edict of Nantes in 1685, and fighting wars that made France Europe's dominant power while draining its treasury.",
      tier: 4, category: 'politics'
    },
    {
      t: ce(1676, 10, 9),
      title: "Leeuwenhoek reports the first observations of bacteria",
      detail: "Using single-lens microscopes he ground himself, Antonie van Leeuwenhoek described tiny 'animalcules' in rainwater and pepper-water infusions (and, in 1683, in scrapings from his own teeth), opening the microbial world to science.",
      tier: 5, category: 'science'
    },
    {
      t: ce(1682, 5, 7), end: ce(1725, 2, 8),
      title: "Peter the Great modernizes Russia",
      detail: "Peter built a navy, remade the army and administration on Western lines, defeated Sweden in the Great Northern War, and founded St Petersburg in 1703, making it his capital on the Baltic in 1712.",
      tier: 4, category: 'empire'
    },
    {
      t: ce(1683, 7, 14), end: ce(1683, 9, 12),
      title: "Ottoman siege of Vienna broken by John III Sobieski's relief army",
      detail: "Two months after Kara Mustafa's army encircled the Habsburg capital, a Polish and Imperial force under King John III Sobieski charged down from the Kahlenberg and routed the besiegers; the Ottomans never again threatened central Europe and lost Hungary by 1699.",
      tier: 5, category: 'war'
    },
    {
      t: ce(1687, 7, 5),
      title: "Newton publishes the Principia, laying down the laws of motion and gravity",
      detail: "Isaac Newton's three laws of motion and law of universal gravitation explained falling apples and orbiting planets with the same mathematics, the foundation of physics for two centuries.",
      tier: 0, category: 'science'
    },
    {
      t: ce(1688, 11, 5),
      title: "Glorious Revolution: William of Orange lands in England",
      detail: "James II fled and Parliament offered the crown to William and Mary on the terms of the 1689 Bill of Rights, establishing parliamentary supremacy over the monarchy.",
      tier: 3, category: 'politics'
    },

    // ---- 1700–1750 ---------------------------------------------------------
    {
      t: ce(1700), end: ce(1800),
      title: "Transatlantic slave trade reaches its peak",
      detail: "European ships carried more than six million enslaved Africans across the Atlantic during the 18th century, the largest forced migration in history, to work the plantations of the Americas.",
      tier: 2, category: 'migration'
    },
    {
      t: ce(1700), end: ce(1800),
      title: "British Agricultural Revolution raises farm yields",
      detail: "Enclosure, four-course crop rotation, the seed drill and selective breeding roughly doubled output per farmer, feeding growing cities and freeing labor for industry.",
      tier: 5, category: 'agriculture'
    },
    {
      t: ce(1707, 5, 1),
      title: "Acts of Union join England and Scotland as Great Britain",
      detail: "The two parliaments merged into one at Westminster, creating the Kingdom of Great Britain with a single crown, currency and free trade across the island.",
      tier: 5, category: 'politics'
    },
    {
      t: ce(1712),
      title: "Newcomen builds the first practical steam engine",
      detail: "Thomas Newcomen's atmospheric engine pumped water from a coal mine near Dudley, the first machine to turn heat into useful mechanical work on a large scale.",
      tier: 5, category: 'technology'
    },
    {
      t: ce(1721, 3, 24),
      title: "J. S. Bach dedicates the Brandenburg Concertos",
      detail: "Johann Sebastian Bach presented six concertos to the Margrave of Brandenburg, a summit of Baroque music; as cantor of St Thomas's in Leipzig from 1723 he went on to write the St Matthew Passion and the Mass in B minor.",
      tier: 5, category: 'art'
    },
    {
      t: ce(1735),
      title: "Linnaeus publishes Systema Naturae",
      detail: "Carl Linnaeus's scheme for classifying living things by kingdom, class, order, genus and species, with two-part Latin names, became the basis of biological taxonomy.",
      tier: 5, category: 'science'
    },
    {
      t: ce(1735, 10, 18), end: ce(1796, 2, 9),
      title: "Qianlong Emperor reigns as Qing China reaches its greatest extent",
      detail: "Qianlong's campaigns conquered Xinjiang and tightened Qing control over Tibet, and China's population passed 300 million, but corruption late in his reign foreshadowed the dynasty's decline.",
      tier: 5, category: 'empire'
    },

    // ---- 1750–1800 ---------------------------------------------------------
    {
      t: ce(1751), end: ce(1772),
      title: "Diderot and d'Alembert publish the Encyclopédie",
      detail: "The 28-volume Encyclopédie, with articles by Voltaire, Rousseau and Montesquieu, gathered the knowledge of the age in a spirit of secular reason and became the flagship of the Enlightenment.",
      tier: 3, category: 'science'
    },
    {
      t: ce(1755, 11, 1),
      title: "Lisbon earthquake and tsunami destroy the Portuguese capital",
      detail: "On All Saints' Day an earthquake, tsunami and fires killed tens of thousands and leveled Lisbon; the disaster shook Enlightenment optimism and prompted the first modern earthquake surveys.",
      tier: 5, category: 'civilization'
    },
    {
      t: ce(1756, 5, 17), end: ce(1763, 2, 15),
      title: "Seven Years' War, the first global conflict",
      detail: "Fought in Europe, North America, India, West Africa and on every ocean, the war left Britain the dominant colonial power, France stripped of Canada, and both crowns deep in debt.",
      tier: 3, category: 'war'
    },
    {
      t: ce(1757, 6, 23),
      title: "Battle of Plassey begins British East India Company rule in Bengal",
      detail: "Robert Clive's victory over the Nawab of Bengal, secured by bribing the Nawab's commander, gave the East India Company control of India's richest province and opened two centuries of British rule.",
      tier: 4, category: 'empire'
    },
    {
      t: ce(1760), end: ce(1840),
      title: "Industrial Revolution",
      detail: "From about 1760 Britain moved from hand production to coal, steam, machines and factories, and railways followed; sustained growth in output and population then spread to Europe and North America, the deepest change in how people live since farming began.",
      tier: 0, category: 'technology'
    },
    {
      t: ce(1768, 8, 26), end: ce(1779, 2, 14),
      title: "Captain Cook's Pacific voyages chart New Zealand, Australia and Hawaii",
      detail: "James Cook's three voyages mapped the Pacific with unprecedented accuracy, proved the marine chronometer at sea, and ended with his death in Hawaii on 14 February 1779.",
      tier: 4, category: 'exploration'
    },
    {
      t: ce(1769, 1, 5),
      title: "James Watt patents his improved steam engine",
      detail: "Watt's separate condenser cut fuel use by three-quarters; his engines, built with Matthew Boulton from 1775, powered mills, mines and later locomotives, driving the Industrial Revolution.",
      tier: 2, category: 'technology'
    },
    {
      t: ce(1775, 4, 19), end: ce(1783, 9, 3),
      title: "American Revolutionary War",
      detail: "From the first shots at Lexington and Concord to the Treaty of Paris, thirteen British colonies, aided by France after 1778, won their independence, sealed by the surrender at Yorktown in 1781.",
      tier: 4, category: 'war'
    },
    {
      t: ce(1776, 3, 9),
      title: "Adam Smith publishes The Wealth of Nations",
      detail: "Smith's analysis of the division of labor, free markets and the 'invisible hand' founded modern economics and argued against mercantilist restrictions on trade.",
      tier: 3, category: 'politics'
    },
    {
      t: ce(1776, 7, 4),
      title: "United States Declaration of Independence adopted",
      detail: "The Continental Congress declared the thirteen colonies free of British rule, asserting that all men are created equal with unalienable rights to life, liberty and the pursuit of happiness.",
      tier: 2, category: 'politics'
    },
    {
      t: ce(1783, 11, 21),
      title: "First human flight: a Montgolfier balloon carries two men over Paris",
      detail: "Pilâtre de Rozier and the Marquis d'Arlandes drifted about nine kilometers in a hot-air balloon built by the Montgolfier brothers, the first untethered flight by human beings.",
      tier: 6, category: 'technology'
    },
    {
      t: ce(1787, 9, 17),
      title: "United States Constitution signed in Philadelphia",
      detail: "Delegates created a federal republic with separated powers and checks and balances; ratified in 1788, it remains the oldest written national constitution still in force.",
      tier: 3, category: 'politics'
    },
    {
      t: ce(1788, 1, 26),
      title: "First Fleet lands at Sydney Cove, founding British Australia",
      detail: "Eleven ships carrying about 750 convicts with their guards established the penal colony of New South Wales, beginning European settlement and the dispossession of Aboriginal peoples.",
      tier: 5, category: 'migration'
    },
    {
      t: ce(1789),
      title: "Lavoisier publishes the Elementary Treatise on Chemistry",
      detail: "Antoine Lavoisier's textbook set out the conservation of mass, the role of oxygen in combustion and a systematic chemical nomenclature, founding modern chemistry.",
      tier: 4, category: 'science'
    },
    {
      t: ce(1789, 7, 14),
      title: "Storming of the Bastille begins the French Revolution",
      detail: "A Paris crowd seized the royal fortress weeks after the Third Estate proclaimed a National Assembly; the revolution abolished feudal privilege, executed the king and convulsed Europe for 25 years.",
      tier: 1, category: 'politics'
    },
    {
      t: ce(1791, 8, 22),
      title: "Enslaved people rise in Saint-Domingue, starting the Haitian Revolution",
      detail: "The uprising in France's richest colony, later led by Toussaint Louverture, became the only slave revolt to found a state when Haiti declared independence in 1804.",
      tier: 3, category: 'politics'
    },
    {
      t: ce(1791, 9, 30),
      title: "Mozart's The Magic Flute premieres in Vienna",
      detail: "Wolfgang Amadeus Mozart conducted the premiere of his last opera ten weeks before his death at 35, leaving the Requiem unfinished and more than 600 works behind.",
      tier: 5, category: 'art'
    },
    {
      t: ce(1796, 5, 14),
      title: "Edward Jenner performs the first smallpox vaccination",
      detail: "Jenner inoculated eight-year-old James Phipps with cowpox and showed it protected him from smallpox, founding immunology and starting the road to the disease's eradication in 1980.",
      tier: 3, category: 'medicine'
    },
    {
      t: ce(1799, 11, 9),
      title: "Napoleon seizes power in the coup of 18 Brumaire",
      detail: "Napoleon Bonaparte overthrew the Directory and made himself First Consul, closing the French Revolution's decade of upheaval and beginning his domination of Europe.",
      tier: 6, category: 'politics'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
