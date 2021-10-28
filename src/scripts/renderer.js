let mayNeedReset = true;
let lastResetTime = localStorage.getItem("lastResetTime");
let expiration = 3600000 * 2; // Integer in ms. 3600000 ms === 1 hr
let gameVersions; // Array to be read from cache/localStorage or fetched.

// represent rows of gameVersions array
let patches = 1;
let gameVersionsDaysPast;
// let gameVersionLatest = 0;
let gameVersionsToUseString;

let weightIMP = 1; // IMP is 'Individual Match Performance' provided by Stratz
let weightActivity = 1; // Activity currently refers to a directly calculated percent of all matches in which the hero is played.
let weightWinrate = 0.5; // 0% is an unplayed hero, 100% is a most played hero.
let weightAdvantage = 0.5;
let multiplierForOrdering = 1000; // -1000 turns 0.536 into -536, useful for percents where the first decimal matters, and must be negative to display in descending order.

// DOM references
const optionsContainer = document.querySelector(".options_grid");
const banBox = document.getElementById("banbox");
const pickBoxes = document.querySelectorAll(".pick");
let draggingElement;
let dataHeroId;
banBox.addEventListener("dragover", (e) => e.preventDefault());
banBox.addEventListener("drop", () => {
  console.log("drop~");
  document
    .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
    .forEach((elem) => elem.classList.add("banned"));
});
banBox.addEventListener("click", (e) => {
  if (e.target.classList.contains("banned")) {
    dataHeroId = e.target.getAttribute("data-heroId");
    document
      .querySelectorAll(`.hero${dataHeroId}`)
      .forEach((elem) => elem.classList.remove("banned"));
  }
});

optionsContainer.addEventListener("dragover", (e) => {
  if (
    e.target.parentElement.classList.contains("player_border") ||
    e.target.classList.contains("pick")
  ) {
    e.preventDefault();
  }
});
optionsContainer.addEventListener("drop", (e) => {
  if (
    e.target.parentElement.classList.contains("player_border") ||
    e.target.classList.contains("pick")
  ) {
    const targetPickBox = e.target.parentElement.querySelector(".pick");
    dataDropId = targetPickBox.getAttribute("data-heroId");
    targetPickBox.classList.remove(`hero${dataDropId}`);
    targetPickBox.removeAttribute("data-heroId", dataDropId);
    document
      .querySelectorAll(`[data-heroId="${dataDropId}"]`)
      .forEach((elem) => elem.classList.remove("picked"));
    let dataHeroId = document
      .querySelector(".dragging")
      .getAttribute("data-heroId");
    document
      .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
      .forEach((elem) => elem.classList.add("picked"));
    targetPickBox.classList.add(`hero${dataHeroId}`);
    targetPickBox.setAttribute("data-heroId", dataHeroId);

    targetPickBox.addEventListener("click", () => {
      dataDropId = targetPickBox.getAttribute("data-heroId");
      targetPickBox.classList.remove(`hero${dataDropId}`);
      targetPickBox.removeAttribute("data-heroId", dataDropId);
      document
        .querySelectorAll(`[data-heroId="${dataHeroId}"]`)
        .forEach((elem) => elem.classList.remove("picked"));
    });
  }
});

// Declares number of players to evaluate. Only change if testing.
let playersTotalInGame = 10;
let targetPath; // = server_log;

let steamIds;
let currentMatch;

document
  .getElementById("buttonEnterIds")
  .addEventListener("click", seeInputBoxes);
document
  .getElementById("cancelSubmission")
  .addEventListener("click", hideInputBoxes);
let formIds = document.getElementById("idSubmission");
let buttonEnterIds = document.getElementById("buttonEnterIds");

function seeInputBoxes() {
  formIds.style = "display: contents;";
  buttonEnterIds.style = "display: none;";
}
function hideInputBoxes() {
  formIds.style = "display: none;";
  buttonEnterIds.style = "display: inline-block;";
}

let validPlayers = [];
function determineValidPlayers() {
  let arr = [];
  for (let i = 0; i < steamIds.length; i++) {
    if (steamIds[i] > 0) arr.push(i);
  }

  return (validPlayers = arr);
}

const fetchThings = async (targetUri, targetItem, backupUri) => {
  const response = await fetch(targetUri);
  if (response.status === 200)
    return (localStorage[targetItem] = await response.text());
  await backupFetch(targetItem, backupUri);
};

const backupFetch = async (targetItem, backupUri) => {
  console.log(`%cFetching backup: %c${backupUri}`, "color:#f4f", "color:#eee");
  const response = await fetch(backupUri);
  if (response.status === 200) {
    let obj = await response.text();
    obj = obj.replace(/"hero_id"/g, `"heroId"`);
    obj = obj.replace(/"games"/g, `"matchCount"`);
    obj = obj.replace(/"last_played"/g, `"lastPlayed"`);
    obj = obj.replace(/"win"/g, `"winCount"`);
    return (localStorage[targetItem] = obj);
  }
};

const fetchAndSave = async (targetItem, targetUri, backupUri) => {
  console.log(`%cFetching: %c${targetUri}`, "color:#f4f", "color:#eee");
  try {
    if (!mayNeedReset && localStorage[targetItem])
      return localStorage[targetItem];
  } catch (error) {
    // if (error === 403 ) try OpenDota API instead, if still 403, say "hidden" in UI for player.
    console.log(error.response);
  }
  await fetchThings(targetUri, targetItem, backupUri);
};

const getGlobalStats = async () => {
  // Get heroStats & gameVersion, and determine which steamIds are valid simultaneously
  await Promise.all([
    fetchAndSave(`heroStats`, `https://api.opendota.com/api/heroStats`),
    fetchAndSave(`gameVersions`, `https://api.stratz.com/api/v1/GameVersion`),
  ]);
  gameVersions = JSON.parse(localStorage.gameVersions);
  gameVersionsDaysPast = Math.round(
    (Date.now() - new Date(gameVersions[patches - 1].startDate)) / 3600000 / 24
  );
  heroStats = JSON.parse(localStorage.heroStats);
};

const promiseChain = async () => {
  // Get heroStats & gameVersion, and determine which steamIds are valid simultaneously
  await determineValidPlayers();
  // Simultaneously get heroPerformance for each player and create hero cards.
  await Promise.all([
    iterateThroughPlayers((i) =>
      fetchAndSave(
        `player${steamIds[i]}patches${patches}`,
        `https://api.stratz.com/api/v1/Player/${steamIds[i]}/heroPerformance?gameVersionId=${gameVersionsToUseString}`,
        `https://api.opendota.com/api/players/${steamIds[i]}/heroes?date=${gameVersionsDaysPast}`
      )
    ), // `?gameVersionId=` a comma-delimited array of patch IDs. Currently saving only the most recent (i.e. gameVersions[0]), but may need to add looping if fetching data from other patches.
    initializeHeroCards(),
  ]);

  orderCards();

  // Simultaneously get personal data (e.g. username) and create player cards.
  await iterateThroughPlayers((i) =>
    fetchAndSave(
      `player${steamIds[i]}`,
      `https://api.stratz.com/api/v1/Player/${steamIds[i]}`
    )
  ),
    iterateThroughPlayers(createPlayerCards);
};

const iterateThroughPlayers = async (callback) => {
  let promiseArray = [];
  for (let i = 0; i < validPlayers.length; i++)
    promiseArray.push(callback(validPlayers[i]));
  return Promise.all(promiseArray);
};

function initializeHeroCards() {
  for (let i = 0; i < heroStats.length; i++) {
    for (let j = 0; j < 10; j++) {
      // Set up element to insert.
      let heroCard = document.createElement("div");
      heroCard.className = `heroCard player${j}`;
      optionsContainer.appendChild(heroCard);
      heroCard.classList.add(`hero${heroStats[i].id}`, `draggable`);
      heroCard.setAttribute("id", `player${j}__hero${heroStats[i].id}`);
      heroCard.setAttribute("data-heroId", `${heroStats[i].id}`);
      heroCard.setAttribute("draggable", true);

      let heroCardPrimaryContainer = document.createElement("div");
      let heroIcon = document.createElement("img");
      let heroScore = document.createElement("span");
      heroCardPrimaryContainer.classList.add(`container`);
      heroIcon.classList.add(`heroIcon`, `hero${heroStats[i].id}`, `draggable`);
      heroScore.className = `heroScore hero${heroStats[i].id} cardData`;
      heroIcon.setAttribute("draggable", true);
      heroIcon.setAttribute("data-heroId", `${heroStats[i].id}`);
      heroCardPrimaryContainer.appendChild(heroIcon);
      heroCardPrimaryContainer.appendChild(heroScore);
      heroCard.appendChild(heroCardPrimaryContainer);

      let collapsingCard = document.createElement("div");
      collapsingCard.className = `collapsingCard`;

      let matchCountContainer = document.createElement("div");
      let elemTitleMatchCount = document.createElement("span");
      let elemMatchCount = document.createElement("span");
      matchCountContainer.className = `container container__matchCount`;
      elemTitleMatchCount.className = `cardTitle cardTitle__matchCount`;
      elemTitleMatchCount.innerText = "Matches";
      elemMatchCount.className = `matchCount cardData`;
      matchCountContainer.appendChild(elemTitleMatchCount);
      matchCountContainer.appendChild(elemMatchCount);

      let winRateContainer = document.createElement("div");
      let elemTitleWinRate = document.createElement("span");
      let elemWinRate = document.createElement("span");
      winRateContainer.className = `container container__winRate`;
      elemTitleWinRate.className = `cardTitle cardTitle__winRate`;
      elemTitleWinRate.innerText = "Win";
      elemWinRate.className = `winRate cardData`;
      winRateContainer.appendChild(elemTitleWinRate);
      winRateContainer.appendChild(elemWinRate);

      let heroIMPContainer = document.createElement("div");
      let elemIMP = document.createElement("span");
      let elemTitleIMP = document.createElement("span");
      heroIMPContainer.className = `container container__heroIMPContainer`;
      elemTitleIMP.className = `cardTitle cardTitle__heroIMP`;
      elemTitleIMP.innerText = "IMP";
      elemIMP.className = `heroIMP cardData`;
      heroIMPContainer.appendChild(elemTitleIMP);
      heroIMPContainer.appendChild(elemIMP);

      let advantageContainer = document.createElement("div");
      let elemAdvScore = document.createElement("span");
      let elemTitleAdv = document.createElement("span");
      advantageContainer.className = `container container__advantage`;
      elemTitleAdv.className = `cardTitle cardTitle__advantage`;
      elemTitleAdv.innerText = "Advantage";
      elemAdvScore.className = `advantage cardData`;
      advantageContainer.appendChild(elemTitleAdv);
      advantageContainer.appendChild(elemAdvScore);

      collapsingCard.appendChild(matchCountContainer);
      collapsingCard.appendChild(winRateContainer);
      collapsingCard.appendChild(heroIMPContainer);
      collapsingCard.appendChild(advantageContainer);
      heroCard.appendChild(collapsingCard);
    }
    let banIcon = document.createElement("div");
    banIcon.className = `icon heroIcon hero${heroStats[i].id}`;
    banBox.appendChild(banIcon);
    banIcon.setAttribute("data-heroId", `${heroStats[i].id}`);

    // banIcon.setAttribute("draggable", true);
  }
  draggables = document.querySelectorAll(`.draggable`);

  optionsContainer.addEventListener("dragstart", (e) => {
    const dragAndGlow = (targetElem) => {
      console.log("dragAndGlow");
      targetElem.classList.add("dragging");
      banBox.classList.add("glow");
      pickBoxes.forEach((pickBox) => pickBox.classList.add("glow"));
      draggingElement = document.querySelector(".dragging");
      console.log(draggingElement);
      dataHeroId = targetElem.getAttribute("data-heroId");
      document
        .querySelectorAll(`.hero${dataHeroId}`)
        .forEach((elem) => elem.classList.remove("banned"));
    };
    console.log(e.target);
    if (e.target.classList.contains("heroCard")) {
      console.log("dragging");
      dragAndGlow(e.target);
    }
  });
  optionsContainer.addEventListener("dragend", (e) => {
    if (e.target.classList.contains("heroCard")) {
      e.target.classList.remove("dragging");
      banBox.classList.remove("glow");
      pickBoxes.forEach((pickBox) => pickBox.classList.remove("glow"));
    }
  });
  optionsContainer.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("heroCard") &&
      !e.target.classList.contains("expanded")
    ) {
      e.target.classList.add("expanded");
    } else if (
      e.target.classList.contains("heroCard") &&
      e.target.classList.contains("expanded")
    ) {
      e.target.classList.remove("expanded");
    }
  });
}

function orderCards() {
  console.log("%cStarting orderCards", "color:#dd0");
  validPlayers.forEach((i) => {
    applyOrderToHeroCard(i, steamIds[i]);
  });
}

async function applyOrderToHeroCard(i, id) {
  console.log(i, id);
  let performanceRef;
  try {
    performanceRef = await JSON.parse(
      localStorage.getItem(`player${id}patches${patches}`)
    );
  } catch (error) {
    // return (document.getElementById(`player${i}__noHeroData`).style.display =
    //   "flex");
  }
  console.log(performanceRef);
  if (performanceRef.length === 0) {
    // document
    //   .querySelectorAll(`.heroCard.player${i}`)
    //   .forEach((elem) => (elem.style = null));
    return (document.getElementById(`player${i}__noHeroData`).style.display =
      "flex");
  }
  let { totalMatchCount, totalHeroesPlayed, mostPlayedPerHero } =
    findTotalMatches(performanceRef);
  console.log(mostPlayedPerHero);
  performanceRef.forEach((playerAsHero) => {
    let { convertedIMP, heroMatchCount, winCount } =
      heroIMPAndMatchCount(playerAsHero);
    if (convertedIMP) {
      document.querySelector(
        `#player${i}__hero${playerAsHero.heroId} .heroIMP`
      ).innerText = Math.round(convertedIMP * 100 - 50);
    } else {
      document.querySelector(
        `#player${i}__hero${playerAsHero.heroId} .heroIMP`
      ).innerText = "N/A";
      document
        .querySelector(`#player${i}__hero${playerAsHero.heroId} .heroIMP`)
        .classList.add("unknownValue");
      convertedIMP = 0.5;
    }
    let orderOfCards = Math.round(
      (multiplierForOrdering *
        (weightIMP * convertedIMP +
          weightWinrate * (winCount / heroMatchCount) +
          weightActivity * (heroMatchCount / mostPlayedPerHero))) /
        (weightIMP + weightActivity + weightWinrate)
    );
    document.getElementById(
      `player${i}__hero${playerAsHero.heroId}`
    ).style.order = -orderOfCards;
    if (orderOfCards) {
      document.querySelector(
        `#player${i}__hero${playerAsHero.heroId} .heroScore`
      ).innerText = Math.round((orderOfCards - multiplierForOrdering / 2) / 10);
    }
    if (heroMatchCount > 0) {
      document.querySelector(
        `#player${i}__hero${playerAsHero.heroId} .winRate`
      ).innerText = Math.round((100 * winCount) / heroMatchCount) + "%";
      document.querySelector(
        `#player${i}__hero${playerAsHero.heroId} .matchCount`
      ).innerText = heroMatchCount;
    }
  });
}

function findTotalMatches(playerPerformanceObj) {
  let totalMatchCount = 0;
  let totalHeroesPlayed = 0;
  let mostPlayedPerHero = 0;
  playerPerformanceObj.forEach((playerAsHero) => {
    totalMatchCount += playerAsHero.matchCount;
    if (playerAsHero.matchCount > 0) totalHeroesPlayed++;
    if (mostPlayedPerHero < playerAsHero.matchCount) {
      mostPlayedPerHero = playerAsHero.matchCount;
      console.log(mostPlayedPerHero);
    }
  });
  return { totalMatchCount, totalHeroesPlayed, mostPlayedPerHero };
}

// Takes each line of heroPerformance, pulls the player's hero IMP score, converts into 0-to-1 scale (compatible with percentages), and returns it.
function heroIMPAndMatchCount(playerAsHero) {
  let convertedIMP;
  if (playerAsHero.imp !== undefined)
    convertedIMP = (playerAsHero.imp + 100) / 200; // turns -100 -> 100 into 0 -> 1
  return {
    convertedIMP: convertedIMP,
    heroMatchCount: playerAsHero.matchCount,
    winCount: playerAsHero.winCount,
  };
}

const createPlayerCards = (i) => {
  let playerRef;
  try {
    if (localStorage[`player${steamIds[i]}`] == "")
      throw "Stratz has no player data.";
    playerRef = JSON.parse(localStorage[`player${steamIds[i]}`]);
    document.querySelector(`.player${i} .player_name`).innerText =
      playerRef?.steamAccount?.name;
    let playeri = document.querySelector(`.player${i} .player_rank`);
    if (playerRef.steamAccount?.seasonRank) {
      let tier = playerRef.steamAccount.seasonRank.toString();
      let medal = tier.charAt(0),
        star = tier.charAt(1);

      switch (medal) {
        case "1":
          playeri.innerText = `Herald ${star}`;
          break;

        case "2":
          playeri.innerText = `Guardian ${star}`;
          break;

        case "3":
          playeri.innerText = `Crusader ${star}`;
          break;

        case "4":
          playeri.innerText = `Archon ${star}`;
          break;

        case "5":
          playeri.innerText = `Legend ${star}`;
          break;

        case "6":
          playeri.innerText = `Ancient ${star}`;
          break;

        case "7":
          playeri.innerText = `Divine ${star}`;
          i;
          break;

        case "8":
          playeri.innerText = `Immortal${
            playerRef.steamAccount.seasonLeaderboardRank
              ? " #" + playerRef.steamAccount.seasonLeaderboardRank
              : ""
          }`;
          break;

        default:
          playeri.innerText = `N/A`;
      }
    } else {
      playeri.innerText = `N/A`;
    }
  } catch {
    console.error(`Could not get player${i} name`);
    return (document.getElementById(`player${i}__noPlayerData`).style.display =
      "block");
  }
};

function useUrlQuery() {
  let url = new URL(window.location.href);
  let paramId = url.searchParams.getAll("id");
  let paramPos = url.searchParams.getAll("pos");
  patches = url.searchParams.get("patches");
  steamIds = paramId;
  for (let i = 0; i < steamIds.length; i++) {
    document.getElementById(`playerId${i}`).value = steamIds[i];
  }
  for (let i = 0; i < paramPos.length; i++) {
    let roleToInsert;
    switch (paramPos[i]) {
      default:
        roleToInsert = "N/A";
        break;
      case "1":
        roleToInsert = "Carry";
        break;
      case "2":
        roleToInsert = "Mid";
        break;
      case "3":
        roleToInsert = "Offlane";
        break;
      case "4":
        roleToInsert = "Soft Support";
        break;
      case "5":
        roleToInsert = "Hard Support";
        break;
    }
    document.getElementById(`player${i}__player_role`).innerText = roleToInsert;
  }
  document.getElementById(`patches`).value = patches;
  let gameVersionToUseArray = [];
  for (let i = 0; i < patches; i++)
    gameVersionToUseArray.push(gameVersions[i].id);
  gameVersionsToUseString = gameVersionToUseArray.toString();
  promiseChain();
}

async function startProgram() {
  if (lastResetTime < Date.now() - expiration) {
    let matchUps = localStorage.getItem(`matchUps`);
    let matchUpsLogTime = localStorage.getItem(`matchUpsLogTime`);
    localStorage.clear();
    localStorage.setItem("lastResetTime", Date.now());
    localStorage.setItem(`matchUps`, matchUps);
    localStorage.setItem(`matchUpsLogTime`, matchUpsLogTime);
  }
  mayNeedReset = false;
  await getGlobalStats();
  useUrlQuery();
}

startProgram();

let matchUpArray = [];
const iterateThroughHeroes = async (callback) => {
  let promiseArray = [];
  for (let i = 0; i < heroStats.length; i++)
    promiseArray.push(callback(heroStats[i].id));
  return Promise.all(promiseArray);
};

const getAllMatchups = () =>
  iterateThroughHeroes((id) => getMatchups(id, heroStats.length - 1));

async function getMatchups(id, take) {
  const query = `query matchupQuery {
      heroStats {
          matchUp(heroId:${id}, take:${take}) {
              heroId
              with {
                  heroId2
                  count
                  wins
                  synergy
              }
              vs {
                  heroId2
                  count
                  wins
                  synergy
              }
          }
      }
  }`;
  async function setResponse(repeatCount) {
    const response = await fetch("https://api.stratz.com/graphql", {
      credentials: "omit",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
      }),
    });
    if (response.status === 429 && repeatCount < 10) {
      setTimeout(setResponse(repeatCount + 1), 3000 * repeatCount);
      console.log(repeatCount);
    }
    if (response.status === 200) {
      let text = await response.text();
      let parsed = JSON.parse(text).data.heroStats.matchUp[0];
      matchUpArray.push(parsed);
    }
  }
  setResponse(0);
}

function findBestSynergyCounter(heroId, allyArray, enemyArray, bans) {
  let matchUps = JSON.parse(localStorage.getItem(`matchUps`));
  let matchUpsOfHero = matchUps.find((element) => element.heroId == heroId);
  let matchUpsOfHeroSpliced = matchUpsOfHero;

  for (let i = 0; i < matchUpsOfHeroSpliced.vs.length; i++) {
    if (bans?.includes(matchUpsOfHeroSpliced.vs[i].heroId2))
      matchUpsOfHeroSpliced.vs.splice(i, 1);
  }
  for (let i = 0; i < matchUpsOfHeroSpliced.with.length; i++) {
    if (bans?.includes(matchUpsOfHeroSpliced.with[i].heroId2))
      matchUpsOfHeroSpliced.with.splice(i, 1);
  }

  let strongestCounters = matchUpsOfHeroSpliced.vs.slice(
    matchUpsOfHeroSpliced.vs.length + enemyArray?.length - 5,
    matchUpsOfHeroSpliced.vs.length
  );
  enemyArray?.forEach((heroId2) => {
    strongestCounters.push(
      matchUpsOfHeroSpliced.vs.find((element) => element.heroId2 == heroId2)
    );
  });

  let strongestCountersScore = 0;
  strongestCounters.forEach((elem) => {
    if (elem?.synergy) strongestCountersScore += elem.synergy;
  });

  let strongestTeam = matchUpsOfHeroSpliced.with.slice(
    0,
    4 - allyArray?.length
  );
  allyArray?.forEach((heroId2) => {
    strongestTeam.push(
      matchUpsOfHeroSpliced.with.find((element) => element.heroId2 == heroId2)
    );
  });

  let strongestTeamScore = 0;
  console.log(strongestTeam);
  strongestTeam.forEach((elem) => {
    if (elem?.synergy) strongestTeamScore += elem.synergy;
  });

  let totalPickScore = strongestCountersScore + strongestTeamScore;

  return {
    strongestCounters,
    strongestCountersScore,
    strongestTeam,
    strongestTeamScore,
    totalPickScore,
  };
}

function applyAdvScore(player, heroId) {
  document.querySelector(
    `#player${player}__hero${heroId} > div.collapsingCard > div.container.container__advantage > span.advantage.cardData`
  ).innerText = Math.round(
    findBestSynergyCounter(heroId, allyArray, enemyArray, bans)[4]
  );
}

const getPickBanArrays = () => {
  let pickArray = document.querySelectorAll(`.pick`);
  let radiantArray = [];
  let direArray = [];
  let allPicks = [];
  for (let i = 0; i < pickArray.length; i++) {
    let pickId = pickArray[i].getAttribute(`data-heroId`);
    allPicks.push(pickId);
    if (pickId && i < 5) {
      radiantArray.push(pickId);
    }
    if (pickId && i >= 5) direArray.push(pickId);
  }

  let banArray = document.querySelectorAll(`#banbox .banned`);
  let bans = [];
  for (let i = 0; i < banArray.length; i++) {
    let banId = banArray[i].getAttribute(`data-heroId`);
    if (banId) bans.push(banId);
  }
  return { allPicks, radiantArray, direArray, bans };
};

// async function applyAllAdv() {
//   for (let i = 0; i < 10; i++) {
//     for (let j = 0; j < heroStats.length; j++) {
//       applyAdvScore(i, heroStats[j].id);
//     }
//   }
// }
async function applyAllAdv2() {
  let { allPicks, radiantArray, direArray, bans } = getPickBanArrays();
  let heroAdv = iterateThroughHeroes((heroId) => {
    let radiantAdv;
    let direAdv;
    if (!allPicks.includes(heroId) && !bans.includes(heroId)) {
      // iterateThroughPlayers((i) => applyAdvScore(i, j));
      radiantAdv = findBestSynergyCounter(
        heroId,
        radiantArray,
        direArray,
        bans
      ).totalPickScore;
      direAdv = findBestSynergyCounter(
        heroId,
        direArray,
        radiantArray,
        bans
      ).totalPickScore;
      for (let radiantPlayer = 0; radiantPlayer < 5; radiantPlayer++) {
        document.querySelector(
          `#player${radiantPlayer}__hero${heroId} > div.collapsingCard > div.container.container__advantage > span.advantage.cardData`
        ).innerText = Math.round(radiantAdv);
      }
      for (let direPlayer = 5; direPlayer < 10; direPlayer++) {
        document.querySelector(
          `#player${direPlayer}__hero${heroId} > div.collapsingCard > div.container.container__advantage > span.advantage.cardData`
        ).innerText = Math.round(direAdv);
      }
    }
  });
}
