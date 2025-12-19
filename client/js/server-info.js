fetch('/server-info')
  .then(res => res.json())
  .then(info => {

    // Titre de l’onglet
    if (info.title) {
      document.title = info.title;
    }

    // Contenu visible
    const team_titleEl = document.getElementById('team-title');
    const team_title = `${info.title} - Équipes`
    if (team_titleEl && team_title) {
      team_titleEl.textContent = team_title;
    }

    const leaderboard_titleEl = document.getElementById('leaderboard-title');
    const leaderboard_title = `${info.title} - Classement`
    if (leaderboard_titleEl && leaderboard_title) {
      leaderboard_titleEl.textContent = leaderboard_title;
    }

    const connection_titleEl = document.getElementById('connection-title');
    const connection_title = `${info.title} - Connexion`
    if (connection_titleEl && connection_title) {
      connection_titleEl.textContent = connection_title;
    }
    
    const friends_titleEl = document.getElementById('friends-title');
    const friends_title = `${info.title} - Amis`
    if (friends_titleEl && friends_title) {
      friends_titleEl.textContent = friends_title;
    }
    
    const dashboard_titleEl = document.getElementById('dashboard-title');
    const dashboard_title = `${info.title} - Tableau de bord`
    if (dashboard_titleEl && dashboard_title) {
      dashboard_titleEl.textContent = dashboard_title;
    }

    const create_titleEl = document.getElementById('create-title');
    const create_title = `${info.title} - Créer un défi`
    if (create_titleEl && create_title) {
      create_titleEl.textContent = create_title;
    }
    
    const challenges_titleEl = document.getElementById('challenges-title');
    const challenges_title = `${info.title} - Défis`
    if (challenges_titleEl && challenges_title) {
      challenges_titleEl.textContent = challenges_title;
    }
    
    const mechanics_titleEl = document.getElementById('mechanics-title');
    const mechanics_title = `${info.title} - Mécaniques de jeu`
    if (mechanics_titleEl && mechanics_title) {
      mechanics_titleEl.textContent = mechanics_title;
    }

    const detail_titleEl = document.getElementById('detail-title');
    const detail_title = `${info.title} - Détails du défi`
    if (detail_titleEl && detail_title) {
      detail_titleEl.textContent = detail_title;
    }

    const titleEl = document.getElementById('server-title');
    if (titleEl && info.title) {
      titleEl.textContent = info.title;
    }

    const subtitleEl = document.getElementById('server-subtitle');
    if (subtitleEl && info.subtitle) {
      subtitleEl.textContent = info.subtitle;
    }
  })
  .catch(err => console.error('Erreur server-info:', err));
