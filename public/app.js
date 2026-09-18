const devicesEl = document.getElementById('devices');
const scenesEl = document.getElementById('scenes');
const statusCard = document.getElementById('statusCard');
const deviceCount = document.getElementById('deviceCount');
const refreshBtn = document.getElementById('refreshBtn');
const deviceTemplate = document.getElementById('deviceTemplate');
const sceneTemplate = document.getElementById('sceneTemplate');

function setStatus(message, isError = false) {
  statusCard.textContent = message;
  statusCard.classList.toggle('error', isError);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Request failed');
  }

  return payload;
}

function renderDevices(devices) {
  devicesEl.innerHTML = '';
  deviceCount.textContent = `${devices.length} devices`;

  devices.forEach((device) => {
    const node = deviceTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.device-name').textContent = device.name;
    node.querySelector('.device-meta').textContent = device.type + (device.value !== undefined ? ` · ${device.value}` : '');
    node.querySelector('.badge').textContent = device.dimmable ? 'Dimbaar' : 'Aan/uit';

    const onBtn = node.querySelector('.on-btn');
    const offBtn = node.querySelector('.off-btn');
    const sliderWrap = node.querySelector('.slider-wrap');
    const slider = node.querySelector('.dim-slider');
    const sliderValue = node.querySelector('.slider-value');

    if (device.dimmable) {
      sliderWrap.classList.remove('hidden');
      slider.value = Number.isFinite(Number(device.value)) ? Number(device.value) : 0;
      sliderValue.textContent = `${slider.value}%`;
      slider.addEventListener('input', () => {
        sliderValue.textContent = `${slider.value}%`;
      });
      slider.addEventListener('change', async () => {
        setStatus(`Dimt ${device.name} naar ${slider.value}%...`);
        try {
          await api(`/api/devices/${encodeURIComponent(device.name)}/dim`, {
            method: 'POST',
            body: JSON.stringify({ level: Number(slider.value) })
          });
          setStatus(`Klaar: ${device.name} staat op ${slider.value}%`);
        } catch (error) {
          setStatus(error.message, true);
        }
      });
    }

    onBtn.addEventListener('click', async () => {
      setStatus(`Zet ${device.name} aan...`);
      try {
        await api(`/api/devices/${encodeURIComponent(device.name)}/on`, { method: 'POST' });
        setStatus(`Klaar: ${device.name} aan`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    offBtn.addEventListener('click', async () => {
      setStatus(`Zet ${device.name} uit...`);
      try {
        await api(`/api/devices/${encodeURIComponent(device.name)}/off`, { method: 'POST' });
        setStatus(`Klaar: ${device.name} uit`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    devicesEl.appendChild(node);
  });
}

function renderScenes(scenes) {
  scenesEl.innerHTML = '';

  scenes.forEach((scene) => {
    const node = sceneTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.scene-name').textContent = scene.name;
    const button = node.querySelector('.scene-btn');

    button.addEventListener('click', async () => {
      setStatus(`Activeer scene ${scene.name}...`);
      try {
        await api(`/api/scenes/${encodeURIComponent(scene.name)}`, { method: 'POST' });
        setStatus(`Klaar: scene ${scene.name} geactiveerd`);
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    scenesEl.appendChild(node);
  });
}

async function loadState() {
  setStatus('Gegevens ophalen van de SHC...');
  const state = await api('/api/state');

  if (state.error) {
    setStatus(`SHC fout: ${state.error}`, true);
    return;
  }

  if (!state.ready) {
    deviceCount.textContent = 'waiting';
    devicesEl.innerHTML = '';
    scenesEl.innerHTML = '';
    setStatus('SHC is nog bezig met initialiseren. Probeer zo meteen opnieuw.');
    return;
  }

  renderDevices(state.devices || []);
  renderScenes(state.scenes || []);
  setStatus('Klaar.');
}

refreshBtn.addEventListener('click', () => {
  loadState().catch((error) => setStatus(error.message, true));
});

loadState().catch((error) => setStatus(error.message, true));
