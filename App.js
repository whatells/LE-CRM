(function () {
  const state = {
    dashboard: null,
    settings: [],
    logs: [],
    config: null
  };

  document.addEventListener('DOMContentLoaded', function () {
    setupTabs();
    attachEvents();
    loadPublicConfig();
    if (INITIAL_VIEW === 'settings') {
      activateTab('settingsView');
    } else if (INITIAL_VIEW === 'logs') {
      activateTab('logsView');
    } else {
      activateTab('dashboardView');
    }
    loadDashboard();
    loadSettings();
    loadLogs();
  });

  function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        activateTab(tab.dataset.target);
      });
    });
  }

  function attachEvents() {
    const refreshBtn = document.getElementById('refreshBtn');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const addSettingBtn = document.getElementById('addSettingBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', onRefreshDashboard);
    }
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', function () {
        activateTab('settingsView');
      });
    }
    if (addSettingBtn) {
      addSettingBtn.addEventListener('click', function () {
        appendSettingRow({ key: '', value: '', notes: '' });
      });
    }
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', saveSettings);
    }
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', loadLogs);
    }
  }

  function activateTab(targetId) {
    const tabs = document.querySelectorAll('.tab');
    const views = document.querySelectorAll('.view');
    tabs.forEach(function (tab) {
      const isActive = tab.dataset.target === targetId;
      tab.classList.toggle('active', isActive);
    });
    views.forEach(function (view) {
      view.classList.toggle('hidden', view.id !== targetId);
      view.classList.toggle('active', view.id === targetId);
    });
  }

  function onRefreshDashboard() {
    setDashboardLoading(true);
    google.script.run
      .withSuccessHandler(function (response) {
        setDashboardLoading(false);
        if (response && response.ok) {
          renderDashboard(response.data);
          showToast('Dashboard mis à jour.');
        } else {
          showToast('Réponse invalide du serveur.', 'error');
        }
      })
      .withFailureHandler(function (error) {
        setDashboardLoading(false);
        handleServerError(error);
      })
      .uiRefreshDashboard();
  }

  function loadDashboard() {
    setDashboardLoading(true);
    google.script.run
      .withSuccessHandler(function (response) {
        setDashboardLoading(false);
        if (response && response.ok) {
          renderDashboard(response.data);
        } else {
          showToast('Impossible de charger le dashboard.', 'error');
        }
      })
      .withFailureHandler(function (error) {
        setDashboardLoading(false);
        handleServerError(error);
      })
      .uiFetchDashboard();
  }

  function renderDashboard(data) {
    if (!data) {
      return;
    }
    state.dashboard = data;
    const updatedAt = document.getElementById('dashboardUpdatedAt');
    if (updatedAt) {
      updatedAt.textContent = data.generatedAt || '-';
    }
    renderKpis(data.kpis || []);
    renderTables(data.tables || []);
  }

  function renderKpis(kpis) {
    const grid = document.getElementById('kpiGrid');
    if (!grid) {
      return;
    }
    grid.innerHTML = '';
    if (!kpis.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Aucune donnée disponible.';
      grid.appendChild(empty);
      return;
    }
    kpis.forEach(function (kpi) {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      const label = document.createElement('p');
      label.className = 'kpi-label';
      label.textContent = kpi.label;
      const value = document.createElement('p');
      value.className = 'kpi-value';
      value.textContent = kpi.display || kpi.value || '-';
      card.appendChild(label);
      card.appendChild(value);
      grid.appendChild(card);
    });
  }

  function renderTables(tables) {
    const container = document.getElementById('tablesContainer');
    if (!container) {
      return;
    }
    container.innerHTML = '';
    tables.forEach(function (table) {
      const card = document.createElement('div');
      card.className = 'table-card';
      const title = document.createElement('h3');
      title.textContent = table.title;
      card.appendChild(title);

      const tableEl = document.createElement('table');
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      (table.headers || []).forEach(function (header) {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      tableEl.appendChild(thead);

      const tbody = document.createElement('tbody');
      if (table.rows && table.rows.length) {
        table.rows.forEach(function (row) {
          const tr = document.createElement('tr');
          row.forEach(function (cell) {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      } else {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = (table.headers || []).length || 1;
        td.textContent = 'Aucune donnée.';
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      tableEl.appendChild(tbody);
      card.appendChild(tableEl);
      container.appendChild(card);
    });
    toggleDashboardContent(true);
  }

  function toggleDashboardContent(show) {
    const loader = document.getElementById('dashboardLoader');
    const content = document.getElementById('dashboardContent');
    if (loader) {
      loader.classList.toggle('hidden', show);
    }
    if (content) {
      content.classList.toggle('hidden', !show);
    }
  }

  function setDashboardLoading(isLoading) {
    const loader = document.getElementById('dashboardLoader');
    const content = document.getElementById('dashboardContent');
    if (!loader || !content) {
      return;
    }
    loader.classList.toggle('hidden', !isLoading);
    content.classList.toggle('hidden', isLoading);
  }

  function loadSettings() {
    google.script.run
      .withSuccessHandler(function (response) {
        if (response && response.ok) {
          state.settings = response.settings || [];
          renderSettings();
        } else {
          showToast('Impossible de charger les paramètres.', 'error');
        }
      })
      .withFailureHandler(handleServerError)
      .uiFetchSettings();
  }

  function renderSettings() {
    const tbody = document.querySelector('#settingsTable tbody');
    if (!tbody) {
      return;
    }
    tbody.innerHTML = '';
    if (!state.settings.length) {
      appendSettingRow({ key: '', value: '', notes: '' });
      return;
    }
    state.settings.forEach(function (setting) {
      appendSettingRow(setting);
    });
  }

  function appendSettingRow(setting) {
    const tbody = document.querySelector('#settingsTable tbody');
    if (!tbody) {
      return;
    }
    const tr = document.createElement('tr');
    const keyTd = document.createElement('td');
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = setting.key || '';
    keyInput.placeholder = 'IDENTIFIANT_PARAM';
    keyTd.appendChild(keyInput);

    const valueTd = document.createElement('td');
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.value = setting.value || '';
    valueTd.appendChild(valueInput);

    const notesTd = document.createElement('td');
    const notesInput = document.createElement('textarea');
    notesInput.rows = 1;
    notesInput.value = setting.notes || '';
    notesTd.appendChild(notesInput);

    const actionsTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-row';
    removeBtn.setAttribute('aria-label', 'Supprimer la ligne');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', function () {
      tr.remove();
    });
    actionsTd.appendChild(removeBtn);

    tr.appendChild(keyTd);
    tr.appendChild(valueTd);
    tr.appendChild(notesTd);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }

  function saveSettings() {
    const tbody = document.querySelector('#settingsTable tbody');
    if (!tbody) {
      return;
    }
    const rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    const payload = rows
      .map(function (row) {
        const inputs = row.querySelectorAll('input, textarea');
        const key = inputs[0] ? inputs[0].value.trim() : '';
        if (!key) {
          return null;
        }
        return {
          key: key,
          value: inputs[1] ? inputs[1].value : '',
          notes: inputs[2] ? inputs[2].value : ''
        };
      })
      .filter(function (entry) { return entry; });

    google.script.run
      .withSuccessHandler(function (response) {
        if (response && response.ok) {
          showToast('Paramètres enregistrés.', 'success');
          loadSettings();
        } else {
          showToast('Erreur lors de la sauvegarde.', 'error');
        }
      })
      .withFailureHandler(handleServerError)
      .uiSaveSettings(payload);
  }

  function loadLogs() {
    google.script.run
      .withSuccessHandler(function (response) {
        if (response && response.ok) {
          state.logs = response.logs || [];
          renderLogs();
        }
      })
      .withFailureHandler(handleServerError)
      .uiFetchLogs();
  }

  function renderLogs() {
    const list = document.getElementById('logsList');
    if (!list) {
      return;
    }
    list.innerHTML = '';
    if (!state.logs.length) {
      const empty = document.createElement('li');
      empty.className = 'log-item';
      empty.textContent = 'Aucun log disponible.';
      list.appendChild(empty);
      return;
    }
    state.logs.forEach(function (log) {
      const item = document.createElement('li');
      item.className = 'log-item';
      const meta = document.createElement('div');
      meta.className = 'log-meta';
      meta.textContent = '[' + (log.level || 'INFO') + '] ' + (log.timestamp || '—') + ' — ' + (log.source || '');
      const message = document.createElement('div');
      message.className = 'log-message';
      message.textContent = log.message || '';
      item.appendChild(meta);
      item.appendChild(message);
      if (log.details) {
        const details = document.createElement('div');
        details.className = 'log-details';
        details.textContent = log.details;
        item.appendChild(details);
      }
      list.appendChild(item);
    });
  }

  function loadPublicConfig() {
    google.script.run
      .withSuccessHandler(function (response) {
        if (response && response.ok) {
          state.config = response.config;
        }
      })
      .withFailureHandler(function () {
        /* silencieux */
      })
      .uiFetchPublicConfig();
  }

  function handleServerError(error) {
    console.error('Serveur Apps Script', error);
    const message = extractMessage(error);
    showToast(message || 'Erreur inattendue.', 'error');
  }

  function extractMessage(error) {
    if (!error) {
      return '';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error.message) {
      return error.message.replace('Exception: ', '');
    }
    return JSON.stringify(error);
  }

  function showToast(message, type) {
    const toast = document.getElementById('toast');
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.remove('hidden', 'error', 'success');
    if (type === 'error') {
      toast.classList.add('error');
    } else if (type === 'success') {
      toast.classList.add('success');
    }
    setTimeout(function () {
      toast.classList.add('hidden');
      toast.classList.remove('error', 'success');
    }, 4000);
  }
})();
