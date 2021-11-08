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
