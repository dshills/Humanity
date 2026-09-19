(function (root) {
  'use strict';
  const HT = root.HT || (root.HT = {});

  // Guided tours: short, hand-written paths through the events. A step names an event by its exact title
  // (test/tours.test.js checks that every one exists and that each tour runs forward in time) and adds a
  // sentence or two of narration that carries the thread from the previous step. Rules: id is a lowercase slug,
  // title <= 40 characters, blurb 20-160, 5-12 steps, note 20-240 characters.
  HT.tours = [
    {
      id: 'peopling-the-world',
      title: 'Peopling the world',
      blurb: 'From one corner of Africa to the last empty islands of the Pacific, in nine steps.',
      steps: [
        { ev: 'Earliest Homo sapiens (Jebel Irhoud, Morocco)', note: 'The story starts here, 300,000 years ago: people with faces like ours, scattered across Africa, a continent they will not leave in numbers for more than two hundred thousand years.' },
        { ev: 'Modern humans disperse out of Africa', note: 'Earlier ventures into Arabia and the Levant faded out. This one did not: every living person outside Africa descends mostly from the people who left around now.' },
        { ev: 'Humans reach Australia by sea', note: 'Following the southern coast of Asia, people reach a continent no human relative had ever seen. Even at the lowest sea level, the last stretch meant crossing open water.' },
        { ev: 'Modern humans enter Europe', note: 'Turning north-west instead, others enter an Ice Age Europe that already belongs to the Neanderthals. Within a few thousand years only one kind of human is left there.' },
        { ev: 'Humans reach the Americas from Beringia', note: 'The last continents fall when people living on the land bridge between Siberia and Alaska move south past the ice, reaching Chile within perhaps two thousand years.' },
        { ev: 'Lapita voyagers reach Fiji, Tonga and Samoa by canoe', note: 'What is left is ocean. Farmers and sailors whose ancestors set out from Taiwan push beyond the islands any human had reached, carrying their pottery, pigs and crops.' },
        { ev: 'Polynesian voyagers settle the Society Islands and eastern Polynesia (c. 1025)', note: 'After a pause of nearly two thousand years the voyaging resumes, faster than before, navigating thousands of kilometres by stars, swells and the flight of birds.' },
        { ev: 'Polynesians settle the Hawaiian Islands (c. 1220)', note: 'North to the most isolated islands on Earth, 4,000 km from anywhere, found by people looking for land they had no way to know was there.' },
        { ev: 'Polynesians settle New Zealand, the last large landmass reached', note: 'And south to the last large land without people. Some 300,000 years after Jebel Irhoud, and barely 250 before Columbus, the human map of the world is complete.' }
      ]
    },
    {
      id: 'story-of-writing',
      title: 'The story of writing',
      blurb: 'How marks on clay became books, alphabets and a web of linked pages.',
      steps: [
        { ev: 'Sumerians invent cuneiform writing at Uruk', note: 'Writing begins as bookkeeping: tallies of grain and sheep pressed into wet clay by temple accountants. It takes centuries before anyone uses it to record a sentence, let alone a story.' },
        { ev: 'Egyptian hieroglyphs first appear at Abydos', note: 'At almost the same moment, labels in a royal tomb on the Nile show a second system. Whether Egypt borrowed the idea or had it independently is still argued.' },
        { ev: 'Shang diviners carve the earliest Chinese writing on oracle bones', note: 'Two thousand years later and a continent away, questions to the ancestors are cut into ox bones and turtle shells in a script whose descendants are still in daily use.' },
        { ev: 'Phoenicians spread the first widely used alphabet', note: 'The radical simplification: two dozen signs for sounds instead of hundreds for words. Traders carry it west, and Greek, Latin, Hebrew and Arabic letters all descend from it.' },
        { ev: 'Painters at San Bartolo leave the earliest known Maya writing (c. 300 BCE)', note: 'Writing was invented at least once more, with no contact at all: in Mesoamerica, where the Maya developed a full script able to record anything they could say.' },
        { ev: 'Cai Lun presents papermaking to the Han court', note: 'A script needs a surface. Paper, cheap and light, replaces bamboo and silk in China and slowly travels west, reaching Baghdad in the 700s and Europe four centuries after that.' },
        { ev: 'Diamond Sutra printed, the earliest dated printed book', note: 'With paper comes printing: whole pages carved in reverse on wooden blocks. This scroll carries a date, 11 May 868, and a note that it was made for free distribution.' },
        { ev: 'King Sejong promulgates Hangul, the Korean alphabet', note: 'Most scripts grew; this one was designed, by a king who wanted ordinary people to read. Its letters are diagrams of the mouth making each sound.' },
        { ev: 'Gutenberg prints the 42-line Bible', note: 'Movable metal type, an oil-based ink and a press adapted from winemaking: within fifty years Europe has printed some twenty million books, and ideas move at a new speed.' },
        { ev: 'Berners-Lee announces the World Wide Web on Usenet', note: 'Five thousand years after the clay tablets of Uruk, text comes loose from any surface at all: pages that link to other pages, readable from anywhere, and written by anyone.' }
      ]
    },
    {
      id: 'plagues-and-cures',
      title: 'Plagues and cures',
      blurb: 'Two thousand years of epidemics, and the slow invention of ways to stop them.',
      steps: [
        { ev: 'Antonine Plague sweeps the Roman Empire', note: 'Armies returning from the east bring home a disease, probably smallpox, that kills perhaps a tenth of the empire. Medicine can describe it and do nothing else.' },
        { ev: 'Plague of Justinian, the first recorded plague pandemic', note: 'Four centuries on, bubonic plague arrives by grain ship from Egypt. It returns in waves for two hundred years, and no one connects it with rats or fleas.' },
        { ev: 'Black Death kills a third or more of Europe', note: 'The same bacterium comes back along the trade routes from Asia. In five years it kills on a scale never seen before or since, and reshapes wages, faith and land across a continent.' },
        { ev: 'Ragusa imposes the first quarantine against plague', note: 'The first effective defence needs no theory of disease at all: keep arriving ships and travellers apart for a month and see who sickens. The word quarantine comes from the forty days later used in Venice.' },
        { ev: 'Edward Jenner performs the first smallpox vaccination', note: 'Inoculation with smallpox itself was old in Asia and Africa and risky. Jenner shows that harmless cowpox protects as well, and gives the world the word vaccine, from vacca, cow.' },
        { ev: "Pasteur's swan-neck flask experiments disprove spontaneous generation", note: 'Now the theory: microbes come from other microbes, and specific ones cause specific diseases. Clean water, antiseptic surgery and new vaccines follow within a generation.' },
        { ev: '1918 influenza pandemic', note: 'Knowing about germs is not yet knowing about viruses. Influenza kills some fifty million people in two years, more than the world war that helped to spread it.' },
        { ev: 'Fleming discovers penicillin', note: 'A mould on a forgotten culture plate kills the bacteria around it. It takes until the 1940s to make the drug in quantity, and then infections that were death sentences become routine.' },
        { ev: 'WHO certifies the eradication of smallpox', note: 'The disease of the Antonine Plague, killer of some 300 million people in the twentieth century alone, is hunted down case by case and wiped out. It is still the only human disease ever eradicated.' },
        { ev: 'First Pfizer-BioNTech COVID-19 vaccine given outside clinical trials', note: 'A new coronavirus is sequenced in January 2020; a vaccine built from its genetic code is in use by December. What took Jenner\'s successors two centuries now takes eleven months.' }
      ]
    },
    {
      id: 'empires-of-africa',
      title: 'Kingdoms and empires of Africa',
      blurb: 'Five thousand years of African states, from the first pharaoh to independence.',
      steps: [
        { ev: 'Narmer unifies Upper and Lower Egypt', note: 'One of the first large states anywhere: a single king ruling a thousand kilometres of the Nile, with a bureaucracy, a script and a calendar to run it.' },
        { ev: 'Kingdom of Kerma rules Nubia on the upper Nile', note: 'Upstream, in what is now Sudan, a rival power grows rich on gold, ivory and cattle. Egypt fears it enough to build a chain of fortresses along the border.' },
        { ev: 'Piye of Kush conquers Egypt and founds the Nubian 25th Dynasty', note: 'A thousand years later the tables turn, and kings from Nubia rule the whole Nile valley as pharaohs, restoring temples their Egyptian predecessors had let decay.' },
        { ev: 'Kingdom of Aksum rises as a Red Sea trading power (c. 100 CE)', note: 'In the Ethiopian highlands a new state mints its own gold coins, raises granite stelae thirty metres tall and trades with Rome, Arabia and India.' },
        { ev: 'Ghana Empire rises on the trans-Saharan gold trade (c. 700)', note: 'Camels open the desert. South of it, the kings of Wagadu tax the exchange of gold from the forests for salt from the Sahara, and Arab geographers call their land the country of gold.' },
        { ev: 'Great Zimbabwe rises as the capital of a gold-trading kingdom', note: 'Far to the south, mortarless granite walls eleven metres high enclose the court of a kingdom that sends its gold to the Swahili ports and receives Chinese porcelain in return.' },
        { ev: 'Sundiata Keita founds the Mali Empire after the Battle of Kirina', note: 'Back in the west, Ghana\'s successor is larger still, stretching from the Atlantic to the bend of the Niger. Its founding is still sung by griots as the Epic of Sundiata.' },
        { ev: "Mansa Musa's hajj displays the gold of the Mali Empire", note: 'Its most famous ruler crosses the Sahara with so much gold that prices in Cairo are said to have taken years to recover. European mapmakers draw him holding a nugget.' },
        { ev: 'Askia Muhammad takes the Songhai throne and makes Timbuktu a city of scholars', note: 'Songhai overtakes Mali to become the largest state West Africa has known. Timbuktu\'s teachers and libraries draw students from across the Islamic world.' },
        { ev: 'Ethiopia defeats Italy at the Battle of Adwa', note: 'By the 1890s Europe has claimed almost the whole continent. At Adwa an African army destroys a European one, and Ethiopia alone keeps its independence through the colonial age.' },
        { ev: 'Ghana becomes independent, first of a wave of new African nations', note: 'Taking the name of the old empire, the Gold Coast becomes the first colony south of the Sahara to win its freedom. Within a decade more than thirty others follow.' }
      ]
    },
    {
      id: 'thinking-machines',
      title: 'Thinking machines',
      blurb: 'From counting boards to programs that write: the long road to the computer.',
      steps: [
        { ev: 'Sumerian scribes are thought to use the first abacus', note: 'Calculation leaves the head and moves onto a device: pebbles on a ruled board. For the next four thousand years, every aid to arithmetic is some version of this.' },
        { ev: 'Al-Jazari describes programmable automata in his Book of Ingenious Devices', note: 'A different idea appears in a book of water clocks and mechanical musicians: a machine whose behaviour can be changed by rearranging pegs. It is a program, though nobody calls it that.' },
        { ev: 'Blaise Pascal builds the Pascaline mechanical calculator', note: 'At nineteen, to spare his tax-collector father the drudgery, Pascal builds gears that add and carry by themselves. Arithmetic no longer needs a mind at all.' },
        { ev: 'Ada Lovelace publishes the first computer program', note: 'Babbage designs an engine that could follow any instructions; Lovelace writes a set of them and sees further than he does, to a machine that might compose music if music can be expressed in symbols.' },
        { ev: 'Turing submits "On Computable Numbers"', note: 'A paper about the limits of mathematics defines, almost in passing, a single abstract machine that can imitate any other. Every computer since is an instance of it.' },
        { ev: 'ENIAC, the first general-purpose electronic computer, unveiled', note: 'The idea becomes 18,000 vacuum tubes in a room in Philadelphia, a thousand times faster than anything mechanical and reprogrammed by six women moving cables by hand.' },
        { ev: 'Transistor demonstrated at Bell Labs', note: 'A sliver of germanium does the work of a vacuum tube with no warm-up, little power and nothing to burn out. It can also be made very, very small.' },
        { ev: 'Intel 4004, the first commercial microprocessor', note: 'Twenty-three hundred transistors on a chip the size of a fingernail: a whole processor as a component you can buy. The computer becomes something that can be put inside other things.' },
        { ev: 'Apple Computer founded', note: 'And something a person can own. Within a decade of the microprocessor, machines that once filled rooms and belonged to governments are sitting on kitchen tables.' },
        { ev: 'Deep Blue defeats world chess champion Garry Kasparov', note: 'A machine beats the best human at the game long taken as the measure of intellect, by searching 200 million positions a second. It shows brute force, not understanding.' },
        { ev: 'OpenAI releases ChatGPT', note: 'Twenty-five years later the approach is reversed: networks trained on much of what people have written, rather than programmed with rules. A hundred million people try it within two months.' }
      ]
    },
    {
      id: 'century-of-cinema',
      title: 'A century of cinema',
      blurb: 'From fifty seconds of a train arriving to a Korean thriller taking Best Picture.',
      steps: [
        { ev: 'Lumière brothers hold the first public film screening', note: 'Thirty-three people pay a franc each to sit in the basement of a Paris café and watch ten films of under a minute. Within a year the Lumières have sent operators to every continent.' },
        { ev: 'Metropolis by Fritz Lang', note: 'Thirty years on, film is an art of enormous ambition: a city of towers, a robot in the shape of a woman, tens of thousands of extras. It nearly bankrupts the studio, and shapes every screen future since.' },
        { ev: 'The Jazz Singer by Alan Crosland', note: 'The same year, a few minutes of synchronised song and speech: "You ain\'t heard nothin\' yet." Within three years silent film, and many of its stars, are finished.' },
        { ev: 'Snow White and the Seven Dwarfs by David Hand and William Cottrell', note: 'Hollywood calls it Disney\'s folly: a feature-length cartoon, drawn by hand, frame by frame. It becomes the most successful sound film yet made.' },
        { ev: 'Citizen Kane by Orson Welles', note: 'A twenty-five-year-old from radio gets complete control of his first film and uses deep focus, broken chronology and ceilings on the sets. Critics\' polls will name it the best film ever made for fifty years.' },
        { ev: 'Seven Samurai by Akira Kurosawa', note: 'Cinema\'s centre of gravity was never only American. Kurosawa\'s three-hour epic of villagers hiring swordsmen is remade as a western within six years and imitated ever after.' },
        { ev: 'Breathless by Jean-Luc Godard', note: 'Shot in the streets with a handheld camera, cut with jumps that break every rule: the French New Wave shows that a film can be made cheaply, quickly and personally, by people who began as critics.' },
        { ev: '2001: A Space Odyssey by Stanley Kubrick', note: 'A year before anyone stands on the Moon, Kubrick films spaceflight so convincingly, and a computer so calmly murderous, that both images outlast the real thing in the imagination.' },
        { ev: 'Star Wars released', note: 'With Jaws two summers earlier, this invents the modern blockbuster: opening everywhere at once, selling toys, and returning in sequels. The effects company built to make it changes how all films are made.' },
        { ev: 'Toy Story, the first fully computer-animated feature film', note: 'Every frame is computed rather than drawn or photographed. Within twenty years hand-drawn animation has almost vanished from American cinemas, and most live-action films are partly animated too.' },
        { ev: 'Spirited Away by Hayao Miyazaki', note: 'Drawn by hand all the same, Miyazaki\'s story of a girl in a bathhouse for spirits becomes the most successful film in Japanese history for nineteen years and wins the Oscar for animation.' },
        { ev: 'Parasite, first non-English-language film to win Best Picture', note: 'Ninety-two years after the first Academy Awards, the top prize goes to a film not in English. Its director, Bong Joon-ho, had asked audiences to get over "the one-inch-tall barrier of subtitles".' }
      ]
    },
    {
      id: 'leaving-the-planet',
      title: 'Leaving the planet',
      blurb: 'Sixty-five years of spaceflight, from a beeping sphere to a telescope a million miles away.',
      steps: [
        { ev: 'Sputnik 1 opens the Space Age', note: 'An 84-kilogram polished sphere circles the Earth every 96 minutes, beeping. Anyone with a radio can hear it, and the country that launched it can plainly reach any city on the planet.' },
        { ev: 'Yuri Gagarin becomes the first human in space', note: 'Less than four years later a person goes: one orbit, 108 minutes, and a landing by parachute in a field where a farmer and her granddaughter are the first to greet him.' },
        { ev: 'Apollo 8 orbits the Moon and photographs Earthrise', note: 'Three men leave Earth orbit altogether, the first humans to see the whole planet at once. The photograph they bring back of it rising over the Moon becomes an emblem of the environmental movement.' },
        { ev: 'Apollo 11 lands on the Moon', note: 'Eight years after Gagarin, two people walk on another world while some 600 million watch live. Ten more follow over the next three years, and then no one.' },
        { ev: 'Voyager 1 launched', note: 'The farthest journeys are made by machines. Launched to tour Jupiter and Saturn, Voyager 1 keeps going; in 2012 it becomes the first human-made object to reach interstellar space.' },
        { ev: 'Hubble Space Telescope launched', note: 'Above the blur of the atmosphere, a telescope the size of a bus shows galaxies thirteen billion years back in time, once astronauts have fitted it with corrective optics.' },
        { ev: 'Expedition 1 begins continuous human presence aboard the ISS', note: 'Former rivals build a station together. From this day on there is never a moment when every human being is on Earth.' },
        { ev: 'SpaceX Crew Dragon carries astronauts to orbit', note: 'Reaching orbit stops being something only governments do. A company flies a crew to the station, and lands its boosters upright to fly them again.' },
        { ev: 'James Webb Space Telescope launched', note: 'A gold-plated mirror six and a half metres across unfolds itself a million and a half kilometres from Earth, and begins to look for the first galaxies and for air around other worlds.' }
      ]
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
