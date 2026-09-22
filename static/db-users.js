(function(){
  const TOKEN_KEY='iafas_hub_api_token_v1';
  const SESSION_KEY='panel_ab_user';
  const LEGACY_USER_KEYS=['iafas_hub_users_v423','iafas_hub_users_v421'];
  let apiReady=false;

  async function api(path, options={}){
    const headers={'Content-Type':'application/json', ...(options.headers||{})};
    const token=sessionStorage.getItem(TOKEN_KEY);
    if(token)headers['X-Session-Token']=token;
    const res=await fetch(path,{...options,headers});
    const payload=await res.json().catch(()=>({ok:false,error:'Respuesta inválida del servidor'}));
    if(!res.ok||payload.ok===false)throw new Error(payload.error||'No se pudo completar la operación.');
    return payload;
  }
  window.hubApi=api;

  async function detectApi(){
    try{
      await api('/api/health',{method:'GET'});
      apiReady=true;
    }catch(_e){
      apiReady=false;
    }
    return apiReady;
  }

  async function migrateLegacyUsers(){
    if(!apiReady)return;
    for(const key of LEGACY_USER_KEYS){
      try{
        const raw=localStorage.getItem(key);
        if(!raw)continue;
        const users=JSON.parse(raw);
        if(users&&Object.keys(users).length){
          await api('/api/users/import-local',{method:'POST',body:JSON.stringify({users})});
        }
      }catch(_e){}
    }
  }

  function modules(){
    try{return MODULES;}catch(_e){
      return {
        inicio:{name:'Inicio',group:'Inicio'},
        miniia:{name:'Asistente IAFAS',group:'Inicio'},
        buscador:{name:'Listas AB',group:'Coberturas'},
        exclusiones:{name:'Exclusiones IAFAS',group:'Coberturas'},
        factores:{name:'Factores IAFAS',group:'Coberturas'},
        honorarios:{name:'Calculadora de Honorarios',group:'Operación'},
        manual:{name:'Manual de Normas de Facturación',group:'Biblioteca inteligente'},
        peas:{name:'PEAS',group:'Biblioteca inteligente'},
        capacitaciones:{name:'Capacitaciones IAFAS',group:'Biblioteca inteligente'},
        central:{name:'Central de consultas',group:'Operación'},
        contactos:{name:'Contactos y emergencias',group:'Operación'},
        glosario:{name:'Glosario / Terminología',group:'Operación'},
        usuarios:{name:'Administración',group:'Administración'}
      };
    }
  }

  function apiUserAllowedModules(user){
    if(user?.allowed?.includes('*'))return ['*'];
    const allowed=Array.isArray(user?.allowed)?user.allowed:[];
    const withExclusions=allowed.includes('exclusiones')?allowed:[...allowed,'exclusiones'];
    return withExclusions.filter(id=>modules()[id]);
  }

  function apiPermissionLabel(id){
    return modules()[id]?.name||id;
  }

  function apiSelectedPermissions(){
    return [...document.querySelectorAll('#adminPermissions input:checked')].map(x=>x.value);
  }

  async function refreshUsers(){
    const payload=await api('/api/users',{method:'GET'});
    USERS=payload.users||{};
    return USERS;
  }

  function canManageUsers(){
    return !!sessionUser?.allowed && (sessionUser.allowed.includes('*')||sessionUser.allowed.includes('usuarios'));
  }

  window.renderUsersAdmin=async function(){
    if(!$('usersTable'))return;
    if(!apiReady){
      if(typeof window.__legacyRenderUsersAdmin==='function')return window.__legacyRenderUsersAdmin();
      return;
    }
    if(!canManageUsers())return;
    try{
      await refreshUsers();
      const names=Object.keys(USERS).sort((a,b)=>a.localeCompare(b));
      $('userCount').innerText=names.length+' usuarios';
      $('usersTable').innerHTML=names.map(name=>{
        const u=USERS[name];
        const perms=apiUserAllowedModules(u);
        const labels=perms.includes('*')?'Todos los módulos':perms.map(apiPermissionLabel).join(', ');
        const state=u.active===false?'Inactivo':'Activo';
        return `<tr><td><div class="tech">${esc(u.displayName||name)}</div><div class="sub">${esc(name)}${(name==='dcolan'||name==='ctejada')?' · usuario base':''}</div></td><td><span class="status rest">${esc(u.role||'Consulta rápida')}</span></td><td><span class="status ${u.active===false?'no':'ok'}">${state}</span></td><td><div class="sub">${esc(labels)}</div></td><td><div class="user-actions"><button onclick="editUser('${esc(name)}')">Editar</button><button onclick="toggleUserActive('${esc(name)}')">${u.active===false?'Activar':'Desactivar'}</button><button onclick="deleteUser('${esc(name)}')">Eliminar</button></div></td></tr>`;
      }).join('');
      if(!$('adminPermissions')?.children.length)resetUserForm();
    }catch(err){
      $('usersTable').innerHTML=`<tr><td colspan="5"><div class="empty-state">${esc(err.message)}</div></td></tr>`;
    }
  };

  window.saveUserFromForm=async function(event){
    event.preventDefault();
    if(!apiReady){
      alert('No se pudo conectar con la base central de usuarios. El cambio no fue guardado.');
      return;
    }
    const name=normalizeUserName($('adminUserName')?.value);
    const wasEditing=!!editingUser;
    const payload={
      name,
      displayName:($('adminDisplayName').value||name).trim(),
      password:$('adminPassword')?.value||'',
      role:$('adminRole').value,
      active:!!$('adminActive').checked,
      allowed:apiSelectedPermissions().filter(id=>name==='dcolan'||!['usuarios','fuentes'].includes(id))
    };
    if(!name){alert('Ingresa un usuario válido.');return;}
    if(!wasEditing&&!payload.password){alert('Ingresa una contraseña para el nuevo usuario.');return;}
    try{
      await api(wasEditing?'/api/users/'+encodeURIComponent(name):'/api/users',{method:wasEditing?'PUT':'POST',body:JSON.stringify(payload)});
      await renderUsersAdmin();
      if(sessionUser?.name===name&&USERS[name]){
        sessionUser={name,role:USERS[name].role,allowed:USERS[name].allowed,displayName:USERS[name].displayName};
        sessionStorage.setItem(SESSION_KEY,JSON.stringify(sessionUser));
        if($('userName'))$('userName').innerText=USERS[name].displayName||name;
      }
      resetUserForm();
      if($('userFormMessage'))$('userFormMessage').innerText=wasEditing?'Usuario actualizado en la base de datos.':'Usuario creado en la base de datos.';
    }catch(err){
      alert(err.message);
    }
  };

  window.editUser=function(name){
    const user=USERS[name];if(!user)return;
    editingUser=name;
    $('userFormTitle').innerText='Editar usuario';
    if($('adminSubmitBtn'))$('adminSubmitBtn').innerText='Actualizar usuario';
    $('adminUserName').value=name;$('adminUserName').disabled=true;
    $('adminDisplayName').value=user.displayName||name;
    $('adminPassword').value='';
    $('adminRole').value=user.role||'Consulta rápida';
    $('adminActive').checked=user.active!==false;
    renderPermissionEditor(user.allowed||userModulesForRole(user.role));
    if($('userFormMessage'))$('userFormMessage').innerText='Base SQLite activa. Deja la contraseña vacía si no deseas cambiarla.';
  };

  window.toggleUserActive=async function(name){
    if(!apiReady){alert('No se pudo conectar con la base central de usuarios. El cambio no fue guardado.');return;}
    try{
      await api('/api/users/'+encodeURIComponent(name)+'/toggle',{method:'POST'});
      await renderUsersAdmin();
    }catch(err){alert(err.message);}
  };

  window.deleteUser=async function(name){
    if(!apiReady){alert('No se pudo conectar con la base central de usuarios. El cambio no fue guardado.');return;}
    if(sessionUser?.name===name){alert('No puedes eliminar el usuario con el que estás conectado.');return;}
    if(!confirm('¿Eliminar este usuario de la base de datos?'))return;
    try{
      await api('/api/users/'+encodeURIComponent(name),{method:'DELETE'});
      await renderUsersAdmin();
      resetUserForm();
    }catch(err){alert(err.message);}
  };

  async function dbLogin(event){
    event.preventDefault();
    if(!apiReady){
      alert('Para guardar usuarios en base de datos, abre el portal con abrir-portal-local.cmd.');
      return;
    }
    await migrateLegacyUsers();
    try{
      const payload=await api('/api/login',{method:'POST',body:JSON.stringify({username:$('loginUser').value,password:$('loginPass').value})});
      sessionStorage.setItem(TOKEN_KEY,payload.token);
      sessionUser={...payload.user,allowed:apiUserAllowedModules(payload.user)};
      sessionStorage.setItem(SESSION_KEY,JSON.stringify(sessionUser));
      sessionStorage.removeItem(GUIDE_SEEN_KEY);
      $('loginScreen').classList.add('app-hidden');
      $('appLayout').classList.remove('app-hidden');
      if(canManageUsers())await refreshUsers();
      else USERS={[sessionUser.name]:sessionUser};
      applyAccess();
      init();
      maybeOpenGuide();
    }catch(err){
      alert(err.message);
    }
  }

  async function initDatabaseMode(){
    await detectApi();
    const hosted=!['localhost','127.0.0.1','::1'].includes(location.hostname);
    if(!apiReady){
      if(hosted){
        const oldForm=$('loginForm');
        if(oldForm){
          const newForm=oldForm.cloneNode(true);
          oldForm.replaceWith(newForm);
          newForm.addEventListener('submit',event=>{
            event.preventDefault();
            alert('No se pudo conectar con la base central de usuarios. Intenta nuevamente en unos minutos o contacta al administrador.');
          });
        }
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionUser=null;
        $('appLayout')?.classList.add('app-hidden');
        $('loginScreen')?.classList.remove('app-hidden');
      }
      return;
    }
    await migrateLegacyUsers();
    const oldForm=$('loginForm');
    if(oldForm){
      const newForm=oldForm.cloneNode(true);
      oldForm.replaceWith(newForm);
      newForm.addEventListener('submit',dbLogin);
    }
    const saved=sessionStorage.getItem(SESSION_KEY);
    const token=sessionStorage.getItem(TOKEN_KEY);
    if(!token){
      sessionStorage.removeItem(SESSION_KEY);
      sessionUser=null;
      $('appLayout')?.classList.add('app-hidden');
      $('loginScreen')?.classList.remove('app-hidden');
      return;
    }
    if(saved&&token){
      try{
        sessionUser=JSON.parse(saved);
        sessionUser={...sessionUser,allowed:apiUserAllowedModules(sessionUser)};
        if(canManageUsers())await refreshUsers();
        else USERS={[sessionUser.name]:sessionUser};
        $('loginScreen').classList.add('app-hidden');
        $('appLayout').classList.remove('app-hidden');
        applyAccess();
        init();
      }catch(_e){
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionUser=null;
        $('appLayout')?.classList.add('app-hidden');
        $('loginScreen')?.classList.remove('app-hidden');
      }
    }
  }

  window.__legacyRenderUsersAdmin=window.renderUsersAdmin;
  initDatabaseMode();
})();
