import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import {
  dataBR, iniciais,
  validarPlano, validarLista, contarItensLista,
} from '../../lib/utils.js';
import { TEMPLATE_PADRAO } from '../../lib/checkinDefault.js';
import CheckinForm from '../../components/CheckinForm.jsx';
import Evolucao from './_Evolucao.jsx';
import FotosEvolucao from './_FotosEvolucao.jsx';
import FollowUp from './_FollowUp.jsx';
import Suplementacao from './_Suplementacao.jsx';
import Habitos from './_Habitos.jsx';
import { HABITOS_PADRAO, MESES } from '../paciente/HabitosMes.jsx';
import Anamnese from './_Anamnese.jsx';
import MapaGeral from './_MapaGeral.jsx';
import Bioimpedancia from './_Bioimpedancia.jsx';
import Exames from './_Exames.jsx';
import PlanoBuilder from './_PlanoBuilder.jsx';
import Recibo from './_Recibo.jsx';
import DicaJSON from '../../components/DicaJSON.jsx';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

export default function PacientePerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [paciente, setPaciente] = useState(null);
  const [tab, setTab] = useState('plano');
  const [editandoNasc, setEditandoNasc] = useState(false);
  const [novoNasc, setNovoNasc] = useState('');
  const [salvandoNasc, setSalvandoNasc] = useState(false);
  const [listaDraft, setListaDraft] = useState(null);
  const [ultimaAnamnese, setUltimaAnamnese] = useState(undefined); // undefined=carregando, null=sem anamnese

  async function carregar() {
    const { data } = await supabase
      .from('pacientes').select('*').eq('id', id).maybeSingle();
    setPaciente(data);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from('pacientes').select('*').eq('id', id).maybeSingle();
      if (!active) return;
      setPaciente(data);
    }
    load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    supabase.from('anamneses').select('updated_at')
      .eq('paciente_id', id)
      .order('updated_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setUltimaAnamnese(data?.updated_at ?? null);
      });
    return () => { active = false; };
  }, [id]);

  async function enviarRedefinicaoSenha() {
    if (!paciente?.email) return;
    const ok = window.confirm(
      `Enviar email de redefinição de senha para ${paciente.email}?\n\n` +
      `A paciente vai receber um link válido por 1 hora pra criar uma nova senha. ` +
      `Você não precisa fazer mais nada.`
    );
    if (!ok) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(paciente.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) {
        if (/rate limit/i.test(error.message)) {
          alert('Limite de emails atingido (3/hora no plano grátis do Supabase). Tente de novo daqui a pouco ou configure SMTP próprio em Project Settings → Authentication → SMTP.');
        } else {
          alert('Erro ao enviar: ' + error.message);
        }
        return;
      }
      alert(`✅ Email enviado pra ${paciente.email}!\n\nPede pra paciente verificar a caixa de entrada (e o spam). O link funciona por 1 hora.`);
    } catch (err) {
      alert('Erro inesperado: ' + (err?.message || 'tente de novo'));
    }
  }

  async function inativarOuReativar() {
    const ativando = paciente.ativo === false;
    const msg = ativando
      ? `Reativar ${paciente.nome}? Ela voltará a ter acesso ao app.`
      : `Inativar ${paciente.nome}? Ela perderá acesso ao app, mas todos os dados serão mantidos.`;
    if (!window.confirm(msg)) return;
    await supabase.from('pacientes').update({ ativo: !ativando }).eq('id', id);
    carregar();
  }

  async function salvarNascimento() {
    setSalvandoNasc(true);
    const { error } = await supabase.from('pacientes')
      .update({ nascimento: novoNasc || null }).eq('id', id);
    setSalvandoNasc(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setEditandoNasc(false);
    carregar();
  }

  function calcularIdade(iso) {
    if (!iso) return null;
    const n = new Date(iso + 'T12:00:00');
    const h = new Date();
    let idade = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) idade--;
    return idade;
  }

  if (paciente === null) {
    return (
      <div className="card empty-card">
        <div className="empty-sub">Carregando…</div>
      </div>
    );
  }

  if (!paciente) {
    return (
      <>
        <div className="page-title">Paciente não encontrada</div>
        <div className="card empty-card">
          <div className="empty-sub">Talvez tenha sido removida ou o link esteja desatualizado.</div>
          <button className="btn" onClick={() => navigate('/nutri/pacientes')}>Voltar à lista</button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => navigate('/nutri/pacientes')}
        style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <i className="ti ti-arrow-left" aria-hidden="true"></i> Pacientes
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--amber)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600, color: 'var(--dark)',
        }}>{iniciais(paciente.nome)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div className="page-title" style={{ marginBottom: 0 }}>{paciente.nome}</div>
            {paciente.ativo === false && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                background: '#fee2e2', color: '#b91c1c', borderRadius: 20,
              }}>Inativa</span>
            )}
          </div>
          <div className="page-sub" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{paciente.email} · cadastrada em {dataBR(paciente.created_at)}</span>
            <button onClick={enviarRedefinicaoSenha}
              title="Envia um email pra paciente com link de redefinição de senha"
              style={{
                background: 'transparent', border: '0.5px solid var(--border)',
                borderRadius: 6, padding: '3px 9px', fontSize: 11,
                color: 'var(--gold-deep)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <i className="ti ti-key" aria-hidden="true" style={{ fontSize: 13 }}></i>
              Enviar redefinição de senha
            </button>
            <button onClick={inativarOuReativar}
              title={paciente.ativo === false ? 'Reativar paciente' : 'Inativar paciente'}
              style={{
                background: 'transparent',
                border: `0.5px solid ${paciente.ativo === false ? 'var(--green)' : 'var(--red)'}`,
                borderRadius: 6, padding: '3px 9px', fontSize: 11,
                color: paciente.ativo === false ? 'var(--green)' : 'var(--red)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
              <i className={`ti ti-${paciente.ativo === false ? 'user-check' : 'user-off'}`} style={{ fontSize: 13 }} aria-hidden="true"></i>
              {paciente.ativo === false ? 'Reativar' : 'Inativar'}
            </button>
          </div>
          {editandoNasc ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="date" value={novoNasc} onChange={e => setNovoNasc(e.target.value)}
                style={{
                  padding: '4px 8px', fontSize: 12, margin: 0,
                  border: '0.5px solid var(--border)', borderRadius: 6,
                  fontFamily: 'var(--font-sans)',
                }} />
              <button onClick={salvarNascimento} disabled={salvandoNasc}
                style={{
                  background: 'var(--dark)', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                }}>{salvandoNasc ? '…' : 'Salvar'}</button>
              <button onClick={() => setEditandoNasc(false)} style={{
                background: 'none', border: '0.5px solid var(--border)',
                borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          ) : paciente.nascimento ? (
            <button onClick={() => { setNovoNasc(paciente.nascimento); setEditandoNasc(true); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text3)', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-sans)',
              }}>
              🎂 {dataBR(paciente.nascimento)}
              {(() => {
                const i = calcularIdade(paciente.nascimento);
                return i !== null ? ` · ${i} anos` : '';
              })()}
              <i className="ti ti-edit" style={{ fontSize: 12, marginLeft: 4, opacity: .6 }} aria-hidden="true"></i>
            </button>
          ) : (
            <button onClick={() => { setNovoNasc(''); setEditandoNasc(true); }}
              style={{
                background: 'none', border: '0.5px dashed var(--border)',
                borderRadius: 6, padding: '3px 10px', fontSize: 11,
                color: 'var(--text3)', cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
              + Adicionar data de nascimento
            </button>
          )}
        </div>
      </div>

      <div className="g3">
        <div className="stat">
          <div className="stat-lbl">Objetivo</div>
          <div className="stat-val" style={{ fontSize: 18 }}>{paciente.objetivo ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Tipo de plano</div>
          <div className="stat-val" style={{ fontSize: 18 }}>{paciente.tipo_plano ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Modalidade</div>
          <div className="stat-val" style={{ fontSize: 18 }}>{paciente.modalidade ?? '—'}</div>
        </div>
      </div>

      {/* Banner de próxima consulta */}
      {ultimaAnamnese && (() => {
        const proxima = new Date(ultimaAnamnese);
        proxima.setDate(proxima.getDate() + 30);
        const dias = Math.round((proxima.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const atrasada = dias < 0;
        const cor = atrasada ? '#b91c1c' : dias < 7 ? '#b91c1c' : dias <= 14 ? '#92400e' : '#166534';
        const bg  = atrasada ? '#fee2e2'  : dias < 7 ? '#fee2e2'  : dias <= 14 ? '#fef3c7'  : '#dcfce7';
        const txt = atrasada
          ? 'Consulta atrasada'
          : `Próxima consulta em ${dias} dia${dias === 1 ? '' : 's'}`;
        return (
          <div style={{
            background: bg, borderRadius: 8, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
          }}>
            <i className="ti ti-calendar-event" style={{ fontSize: 15, color: cor, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 13, fontWeight: 600, color: cor }}>{txt}</span>
            <span style={{ fontSize: 12, color: cor, opacity: .75, marginLeft: 'auto' }}>
              Retorno: {proxima.toLocaleDateString('pt-BR')}
            </span>
          </div>
        );
      })()}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, background: 'var(--tab-bg, var(--bg2))',
        borderRadius: 10, padding: 3, marginBottom: 16,
        overflowX: 'auto', scrollbarWidth: 'thin',
      }}>
        {[
          { id: 'evolucao',    label: 'Evolução',     icon: 'chart-line' },
          { id: 'fotos',       label: 'Fotos',        icon: 'camera' },
          { id: 'mapa-geral',  label: 'Mapa Geral',   icon: 'map-2' },
          { id: 'anamnese',    label: 'Anamnese',     icon: 'clipboard-text' },
          { id: 'bioimpedancia', label: 'Bioimpedância', icon: 'activity' },
          { id: 'calculo',     label: 'Cálculo',      icon: 'calculator' },
          { id: 'plano',          label: 'Plano',          icon: 'salad' },
          { id: 'compras',       label: 'Compras',        icon: 'shopping-cart' },
          { id: 'suplementacao', label: 'Suplementação', icon: 'pill' },
          { id: 'habitos',       label: 'Hábitos',       icon: 'checklist' },
          { id: 'habitos-mes',   label: 'Hábitos do mês', icon: 'calendar-stats' },
          { id: 'prescricoes', label: 'Prescrições',  icon: 'file-text' },
          { id: 'ebooks',      label: 'E-books',      icon: 'book-2' },
          { id: 'avaliacao',   label: 'Avaliação',    icon: 'ruler-measure' },
          { id: 'checkin',     label: 'Check-in',     icon: 'clipboard-check' },
          { id: 'exames',      label: 'Exames',       icon: 'test-pipe' },
          { id: 'followup',    label: 'Follow-up',    icon: 'notebook' },
          { id: 'minha-semana', label: 'Minha semana', icon: 'calendar-week' },
          { id: 'recibo',      label: 'Recibo',       icon: 'receipt' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: '0 0 auto',
              padding: '7px 12px', fontSize: 13, fontWeight: 500,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--tab-ativa-txt, var(--dark))' : 'var(--tab-txt, var(--text3))',
              background: tab === t.id ? 'var(--tab-ativa-bg, var(--white))' : 'transparent',
              boxShadow: tab === t.id ? 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05))' : 'none',
              fontFamily: 'var(--font-sans)',
              whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <i className={`ti ti-${t.icon}`} style={{ fontSize: 14 }} aria-hidden="true"></i>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'evolucao'   && <Evolucao pacienteId={paciente.id} paciente={paciente} nutriId={user.id} />}
      {tab === 'fotos'      && <FotosEvolucao pacienteId={paciente.id} pacienteNome={paciente.nome} />}
      {tab === 'mapa-geral' && <MapaGeral pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'anamnese'   && <Anamnese pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'bioimpedancia' && <Bioimpedancia pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'calculo'  && <CalculoEnergetico paciente={paciente} />}
      {tab === 'exames'   && <Exames   pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'followup' && <FollowUp pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'minha-semana' && <MinhaSemana pacienteId={paciente.id} />}
      {tab === 'suplementacao' && <Suplementacao pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'habitos' && <Habitos pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'habitos-mes' && <HabitosMesNutri pacienteId={paciente.id} />}
      {tab === 'plano' && <PlanoBuilder pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} paciente={paciente} onLiberar={(lista) => { setListaDraft(lista); setTab('compras'); }} />}
      {tab === 'compras' && <PublicarLista pacienteId={paciente.id} nutriId={user.id} listaDraft={listaDraft} onDraftClear={() => setListaDraft(null)} />}
      {tab === 'prescricoes' && <EnviarPrescricao pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'ebooks' && <EbooksDaPaciente pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'avaliacao' && <RegistrarAvaliacao pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'checkin' && <CheckinPersonalizado pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'recibo'  && <Recibo pacienteId={paciente.id} nutriId={user.id} />}
    </>
  );
}

/* ============================================================
   CHECK-IN — envio rápido + histórico desta paciente
   (gerenciamento de templates fica em /nutri/checkins)
   ============================================================ */
function CheckinPersonalizado({ pacienteId, nutriId, pacienteNome }) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [templateSel, setTemplateSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState(null);

  async function carregar() {
    const [tplRes, envRes] = await Promise.all([
      supabase.from('checkin_templates').select('*')
        .eq('nutri_id', nutriId)
        .or(`paciente_id.is.null,paciente_id.eq.${pacienteId}`)
        .order('created_at'),
      supabase.from('checkin_envios')
        .select('id, enviado_em, respondido_em, lembrete_enviado_em, perguntas, respostas')
        .eq('paciente_id', pacienteId)
        .order('enviado_em', { ascending: false })
        .limit(10),
    ]);
    setTemplates(tplRes.data ?? []);
    setEnvios(envRes.data ?? []);
    // pré-seleciona: personalizado dessa paciente > is_padrao > primeiro
    const sel = (tplRes.data ?? []).find(t => t.paciente_id === pacienteId)
             ?? (tplRes.data ?? []).find(t => t.is_padrao)
             ?? (tplRes.data ?? [])[0];
    setTemplateSel(sel?.id ?? '');
  }
  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  async function enviar() {
    setAviso(null);
    const tpl = templates.find(t => t.id === templateSel);
    if (!tpl) return setAviso({ tipo: 'erro', msg: 'Selecione um template.' });
    setBusy(true);
    const { error } = await supabase.from('checkin_envios').insert({
      nutri_id: nutriId,
      paciente_id: pacienteId,
      perguntas: tpl.perguntas,
    });
    setBusy(false);
    if (error) return setAviso({ tipo: 'erro', msg: error.message });
    setAviso({ tipo: 'ok', msg: `Check-in "${tpl.nome}" enviado para ${pacienteNome.split(' ')[0]}.` });
    carregar();
  }

  async function reenviarLembrete(envio) {
    const { error } = await supabase
      .from('checkin_envios')
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .eq('id', envio.id);
    if (error) return setAviso({ tipo: 'erro', msg: error.message });
    setAviso({ tipo: 'ok', msg: 'Lembrete enviado.' });
    carregar();
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Enviar check-in rápido</div>
            <div className="card-sub">
              Templates ficam em <strong>Check-ins → Templates</strong>. Aqui você só escolhe e envia para {pacienteNome.split(' ')[0]}.
            </div>
          </div>
          <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => navigate('/nutri/checkins')}>
            <i className="ti ti-settings" aria-hidden="true"></i> Gerenciar
          </button>
        </div>
        <div className="card-body">
          {templates.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text3)' }}>
              Nenhum template disponível. Crie em <strong>Check-ins → Templates</strong>.
            </div>
          ) : (
            <>
              <label className="field-label">Template</label>
              <select value={templateSel} onChange={e => setTemplateSel(e.target.value)}>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nome} ({t.perguntas?.length ?? 0} perguntas)
                    {t.is_padrao ? ' · padrão' : ''}
                    {t.paciente_id === pacienteId ? ' · personalizado' : ''}
                  </option>
                ))}
              </select>

              {aviso && (
                <div style={{
                  marginTop: 10,
                  background: aviso.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: aviso.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
                  padding: '8px 12px', borderRadius: 6, fontSize: 13,
                }}>{aviso.msg}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn" onClick={enviar} disabled={busy}>
                  <i className="ti ti-send" aria-hidden="true"></i> {busy ? '...' : 'Enviar agora'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <CalendarioCheckins pacienteId={pacienteId} />

      <div className="section-label">Últimos check-ins ({envios.length})</div>
      {envios.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nada enviado para esta paciente ainda.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {envios.map((e, i) => {
            const respondeu = !!e.respondido_em;
            const lembrado = !!e.lembrete_enviado_em;
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i === envios.length - 1 ? 'none' : '0.5px solid #f5f0e8',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: respondeu ? 'var(--green-bg)' : (lembrado ? 'var(--orange-bg)' : 'var(--red-bg)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <i className={`ti ti-${respondeu ? 'check' : (lembrado ? 'bell' : 'clock')}`} style={{
                    fontSize: 18,
                    color: respondeu ? 'var(--green)' : (lembrado ? 'var(--orange)' : 'var(--red)'),
                  }} aria-hidden="true"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {respondeu ? `Respondeu em ${dataBR(e.respondido_em)}` : (lembrado ? 'Lembrete enviado' : 'Aguardando resposta')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    Enviado em {dataBR(e.enviado_em)} · {e.perguntas?.length ?? 0} perguntas
                  </div>
                </div>
                {!respondeu && !lembrado && (
                  <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--orange)', borderColor: 'var(--orange)' }}
                    onClick={() => reenviarLembrete(e)}>
                    <i className="ti ti-bell" aria-hidden="true"></i> Lembrete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============================================================
   CALENDÁRIO MENSAL DE CHECK-INS
   ============================================================ */
const CAL_NAV_BTN = {
  background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', color: 'var(--dark)',
};
const MESES_CAL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS_SEM_CAL = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

function CalendarioCheckins({ pacienteId }) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [envios, setEnvios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [diaSel, setDiaSel] = useState(null);

  useEffect(() => {
    setCarregando(true);
    const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const fimDia = new Date(ano, mes + 1, 0).getDate();
    const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(fimDia).padStart(2, '0')}`;
    supabase
      .from('checkin_envios')
      .select('id, enviado_em, respondido_em, perguntas, respostas')
      .eq('paciente_id', pacienteId)
      .gte('enviado_em', inicio)
      .lte('enviado_em', fim + 'T23:59:59.999Z')
      .order('enviado_em', { ascending: true })
      .then(({ data }) => { setEnvios(data ?? []); setCarregando(false); setDiaSel(null); });
  }, [pacienteId, ano, mes]);

  const porData = {};
  envios.forEach(e => {
    const d = e.enviado_em?.slice(0, 10);
    if (d) { if (!porData[d]) porData[d] = []; porData[d].push(e); }
  });

  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const dow = new Date(ano, mes, 1).getDay();
  const offset = dow === 0 ? 6 : dow - 1;

  function navMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a); setDiaSel(null);
  }

  function isoCell(day) {
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const enviosDiaSel = diaSel ? (porData[diaSel] ?? []) : [];

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>
          Calendário de check-ins
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={CAL_NAV_BTN} onClick={() => navMes(-1)} aria-label="mês anterior">
            <i className="ti ti-chevron-left" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 138, textAlign: 'center' }}>
            {MESES_CAL[mes]} {ano}
          </span>
          <button style={CAL_NAV_BTN} onClick={() => navMes(1)} aria-label="próximo mês">
            <i className="ti ti-chevron-right" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {/* Cabeçalho dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {DIAS_SEM_CAL.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#aaa', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grade de dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const day = i + 1;
          const iso = isoCell(day);
          const enviosDia = porData[iso] ?? [];
          const temEnvio = enviosDia.length > 0;
          const respondeu = enviosDia.some(e => !!e.respondido_em);
          const isHoje = iso === hojeISO;
          const isSel = iso === diaSel;
          return (
            <button
              key={iso}
              onClick={() => temEnvio && setDiaSel(isSel ? null : iso)}
              style={{
                padding: '7px 2px', borderRadius: 7, textAlign: 'center',
                fontSize: 12, fontWeight: isHoje || isSel ? 700 : 400, lineHeight: 1,
                background: isSel ? 'var(--dark)' : respondeu ? '#dcfce7' : temEnvio ? '#fef9c3' : 'transparent',
                color: isSel ? '#fff' : isHoje ? 'var(--dark)' : temEnvio ? '#333' : '#bbb',
                border: isHoje && !isSel ? '1.5px solid var(--amber)' : '1px solid transparent',
                cursor: temEnvio ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {day}
              {temEnvio && (
                <div style={{
                  position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 3, height: 3, borderRadius: '50%',
                  background: isSel ? 'rgba(255,255,255,.6)' : respondeu ? '#16a34a' : '#ca8a04',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10, color: '#888', flexWrap: 'wrap' }}>
        {[
          { bg: '#dcfce7', label: 'Respondeu' },
          { bg: '#fef9c3', label: 'Aguardando' },
          { border: '1.5px solid var(--amber)', bg: 'transparent', label: 'Hoje' },
        ].map(item => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, display: 'inline-block', background: item.bg, border: item.border }} />
            {item.label}
          </span>
        ))}
        {carregando && <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Carregando…</span>}
      </div>

      {/* Painel de detalhe do dia selecionado */}
      {diaSel && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10, textTransform: 'capitalize' }}>
            {new Date(diaSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {enviosDiaSel.length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa' }}>Nenhum check-in neste dia.</div>
          ) : enviosDiaSel.map((e, ei) => (
            <div key={e.id} style={{ marginBottom: ei < enviosDiaSel.length - 1 ? 16 : 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, marginBottom: 8,
                color: e.respondido_em ? '#16a34a' : '#ca8a04',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <i className={`ti ti-${e.respondido_em ? 'check' : 'clock'}`} style={{ fontSize: 12 }} aria-hidden="true"></i>
                {e.respondido_em
                  ? `Respondido às ${new Date(e.respondido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : `Aguardando resposta · ${e.perguntas?.length ?? 0} perguntas enviadas`}
              </div>
              {e.respondido_em && e.perguntas?.length > 0 && e.respostas && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {e.perguntas.map((p, pi) => {
                    const resp = e.respostas?.[p.id] ?? e.respostas?.[pi] ?? e.respostas?.[String(pi)];
                    if (resp == null || resp === '') return null;
                    return (
                      <div key={p.id ?? pi} style={{ paddingLeft: 10, borderLeft: '2px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{p.pergunta}</div>
                        <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                          {Array.isArray(resp) ? resp.join(', ') : typeof resp === 'boolean' ? (resp ? 'Sim' : 'Não') : String(resp)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {e.respondido_em && (!e.respostas || !e.perguntas?.length) && (
                <div style={{ fontSize: 12, color: '#aaa', paddingLeft: 10 }}>Resposta registrada sem detalhes.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AVALIAÇÃO ANTROPOMÉTRICA
   ============================================================ */
function RegistrarAvaliacao({ pacienteId, nutriId }) {
  const [historico, setHistorico] = useState([]);
  const [form, setForm] = useState(novaAvaliacao());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function novaAvaliacao() {
    return {
      data: new Date().toISOString().slice(0, 10),
      kg: '', altura_cm: '', cintura_cm: '', quadril_cm: '',
      braco_cm: '', coxa_cm: '', pgc: '', mm_kg: '', obs: '',
    };
  }

  async function carregar() {
    const { data } = await supabase
      .from('peso_registros')
      .select('id, data, kg, altura_cm, cintura_cm, quadril_cm, braco_cm, coxa_cm, pgc, mm_kg, obs')
      .eq('paciente_id', pacienteId)
      .order('data', { ascending: false });
    setHistorico(data ?? []);
  }
  useEffect(() => { carregar(); }, [pacienteId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  function num(v) {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  async function salvar() {
    setFeedback(null);
    if (!form.data || !form.kg) {
      return setFeedback({ tipo: 'erro', msg: 'Data e peso são obrigatórios.' });
    }
    setBusy(true);
    const payload = {
      paciente_id: pacienteId,
      nutri_id: nutriId,
      data: form.data,
      kg: num(form.kg),
      altura_cm: num(form.altura_cm),
      cintura_cm: num(form.cintura_cm),
      quadril_cm: num(form.quadril_cm),
      braco_cm: num(form.braco_cm),
      coxa_cm: num(form.coxa_cm),
      pgc: num(form.pgc),
      mm_kg: num(form.mm_kg),
      obs: form.obs.trim() || null,
    };
    const { error } = await supabase.from('peso_registros').insert(payload);
    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Avaliação registrada.' });
    setForm(novaAvaliacao());
    carregar();
  }

  async function remover(id) {
    if (!window.confirm('Remover esta avaliação?')) return;
    await supabase.from('peso_registros').delete().eq('id', id);
    carregar();
  }

  // IMC calculado em tempo real
  const imcPreview = (() => {
    const k = num(form.kg);
    const a = num(form.altura_cm);
    if (!k || !a) return null;
    return (k / Math.pow(a / 100, 2)).toFixed(1);
  })();

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Nova avaliação antropométrica</div>
            <div className="card-sub">Registre peso e medidas — a paciente verá o gráfico de evolução</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Data</label>
              <input type="date" value={form.data} onChange={set('data')} />
            </div>
            <div>
              <label className="field-label">Peso (kg) *</label>
              <input inputMode="decimal" placeholder="ex: 76,5" value={form.kg} onChange={set('kg')} />
            </div>
            <div>
              <label className="field-label">Altura (cm)</label>
              <input inputMode="decimal" placeholder="ex: 162" value={form.altura_cm} onChange={set('altura_cm')} />
            </div>
          </div>

          {imcPreview && (
            <div style={{
              marginTop: 8, fontSize: 13, color: 'var(--text2)',
              background: 'var(--bg2)', padding: '6px 10px', borderRadius: 6, display: 'inline-block',
            }}>
              IMC calculado: <strong>{imcPreview}</strong> kg/m²
            </div>
          )}

          <div className="section-label" style={{ marginTop: 14, marginBottom: 6 }}>Circunferências (cm)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Cintura</label>
              <input inputMode="decimal" value={form.cintura_cm} onChange={set('cintura_cm')} />
            </div>
            <div>
              <label className="field-label">Quadril</label>
              <input inputMode="decimal" value={form.quadril_cm} onChange={set('quadril_cm')} />
            </div>
            <div>
              <label className="field-label">Braço</label>
              <input inputMode="decimal" value={form.braco_cm} onChange={set('braco_cm')} />
            </div>
            <div>
              <label className="field-label">Coxa</label>
              <input inputMode="decimal" value={form.coxa_cm} onChange={set('coxa_cm')} />
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 14, marginBottom: 6 }}>Composição corporal</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">% gordura corporal</label>
              <input inputMode="decimal" placeholder="ex: 28,5" value={form.pgc} onChange={set('pgc')} />
            </div>
            <div>
              <label className="field-label">Massa magra (kg)</label>
              <input inputMode="decimal" placeholder="ex: 48,2" value={form.mm_kg} onChange={set('mm_kg')} />
            </div>
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>Observação (opcional)</label>
          <textarea rows="2" value={form.obs} onChange={set('obs')}
            placeholder="Ex: avaliação após 30 dias de plano, paciente relata melhora de energia." />

          {feedback && <FeedbackInline f={feedback} />}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={salvar} disabled={busy || !form.kg}>
              <i className="ti ti-check" aria-hidden="true"></i> {busy ? 'Salvando...' : 'Registrar avaliação'}
            </button>
          </div>
        </div>
      </div>

      <div className="section-label">Histórico ({historico.length})</div>
      {historico.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nenhuma avaliação registrada ainda.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso</th>
                <th>Cintura</th>
                <th>Quadril</th>
                <th>% gordura</th>
                <th>M. magra</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historico.map(a => (
                <tr key={a.id}>
                  <td>{dataBR(a.data)}</td>
                  <td><strong>{a.kg ? `${a.kg} kg` : '—'}</strong></td>
                  <td>{a.cintura_cm ? `${a.cintura_cm} cm` : '—'}</td>
                  <td>{a.quadril_cm ? `${a.quadril_cm} cm` : '—'}</td>
                  <td>{a.pgc ? `${a.pgc}%` : '—'}</td>
                  <td>{a.mm_kg ? `${a.mm_kg} kg` : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => remover(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}
                      title="Remover">
                      <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ============================================================
   PUBLICAR PLANO
   ============================================================ */
function PublicarPlano({ pacienteId, nutriId }) {
  const [historico, setHistorico] = useState([]);
  const [json, setJson] = useState('');
  const [validade, setValidade] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [verJson, setVerJson] = useState(null);

  async function carregar() {
    const { data } = await supabase
      .from('planos')
      .select('id, dados, validade, publicado_em')
      .eq('paciente_id', pacienteId)
      .order('publicado_em', { ascending: false })
      .limit(5);
    setHistorico(data ?? []);
  }
  useEffect(() => { carregar(); }, [pacienteId]);

  async function publicar() {
    setFeedback(null);
    let dados;
    try { dados = JSON.parse(json); }
    catch (e) { return setFeedback({ tipo: 'erro', msg: 'JSON inválido: ' + e.message }); }

    const v = validarPlano(dados);
    if (!v.ok) return setFeedback({ tipo: 'erro', msg: v.erro });

    setBusy(true);
    const { error } = await supabase.from('planos').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
      dados,
      validade: validade || dados.validade || null,
    });
    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Plano publicado! A paciente verá agora.' });
    setJson('');
    setValidade('');
    carregar();
  }

  async function excluirPlano(p) {
    const data = dataBR(p.publicado_em);
    if (!window.confirm(`Excluir plano publicado em ${data}?\n\nA paciente não verá mais este plano. Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('planos').delete().eq('id', p.id);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Plano excluído.' });
    carregar();
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Publicar novo plano alimentar</div>
            <div className="card-sub">Cole o JSON gerado pela sua Skill 6 (plano + macros + refeições)</div>
          </div>
        </div>
        <div className="card-body">
          <label className="field-label">JSON do plano</label>
          <textarea
            value={json}
            onChange={e => setJson(e.target.value)}
            rows={10}
            placeholder='{"macros": {"kcal": 1500, ...}, "refeicoes": [...]}'
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />

          <DicaJSON
            exemploPrompt='gera um JSON de plano alimentar pra paciente com objetivo de emagrecimento, 1500 kcal, 4 refeições (café, almoço, lanche, jantar). Estrutura: { "macros": { "kcal": 1500, "proteinas_g": 90, "carbo_g": 150, "gorduras_g": 50, "agua_l": 2.5 }, "refeicoes": [{ "nome": "Café da manhã", "horario": "07:30", "alimentos": [{ "nome": "...", "quantidade": "...", "subs": [{ "nome": "..." }] }] }] }' />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 10 }}>
            <div>
              <label className="field-label">Validade (opcional)</label>
              <input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn" onClick={publicar} disabled={busy || !json.trim()}>
                <i className="ti ti-send" aria-hidden="true"></i> {busy ? 'Publicando...' : 'Publicar plano'}
              </button>
            </div>
          </div>

          {feedback && <FeedbackInline f={feedback} />}
        </div>
      </div>

      <HistoricoLista
        titulo="Planos publicados"
        items={historico}
        onDelete={excluirPlano}
        renderItem={(p) => (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {p.dados?.macros?.kcal ? `${p.dados.macros.kcal} kcal · ` : ''}
                {p.dados?.refeicoes?.length ?? 0} refeições
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                Publicado em {dataBR(p.publicado_em)}
                {p.validade && ` · válido até ${dataBR(p.validade)}`}
              </div>
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setVerJson(p)}>
              <i className="ti ti-code" aria-hidden="true"></i> JSON
            </button>
          </>
        )}
      />

      {verJson && (
        <VerJsonModal item={verJson} dados={verJson.dados} onClose={() => setVerJson(null)} />
      )}
    </>
  );
}

/* ============================================================
   PUBLICAR LISTA DE COMPRAS
   ============================================================ */
function PublicarLista({ pacienteId, nutriId, listaDraft, onDraftClear }) {
  const [lista, setLista]         = useState(null);
  const [editando, setEditando]   = useState(false);
  const [novoItemCat, setNovoItemCat]   = useState(null);
  const [novoItemTexto, setNovoItemTexto] = useState('');
  const [historico, setHistorico] = useState([]);
  const [busy, setBusy]           = useState(false);
  const [feedback, setFeedback]   = useState(null);

  useEffect(() => { carregar(); }, [pacienteId]);

  useEffect(() => {
    if (listaDraft) { setLista(listaDraft); setEditando(false); setFeedback(null); }
  }, [listaDraft]);

  async function carregar() {
    const { data } = await supabase
      .from('listas_compras')
      .select('id, dados, publicado_em')
      .eq('paciente_id', pacienteId)
      .order('publicado_em', { ascending: false })
      .limit(5);
    setHistorico(data ?? []);
  }

  async function publicar() {
    if (!lista) return;
    setFeedback(null);
    setBusy(true);
    const { error } = await supabase.from('listas_compras').insert({ paciente_id: pacienteId, nutri_id: nutriId, dados: lista });
    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Lista publicada! A paciente verá agora.' });
    setLista(null);
    setEditando(false);
    onDraftClear?.();
    carregar();
  }

  async function excluirLista(l) {
    if (!window.confirm(`Excluir lista publicada em ${dataBR(l.publicado_em)}?\n\nA paciente não verá mais esta lista.`)) return;
    const { error } = await supabase.from('listas_compras').delete().eq('id', l.id);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Lista excluída.' });
    carregar();
  }

  function removerItem(catLabel, idx) {
    setLista(prev => ({
      ...prev,
      lista: prev.lista
        .map(c => c.categoria === catLabel ? { ...c, itens: c.itens.filter((_, i) => i !== idx) } : c)
        .filter(c => c.itens.length > 0),
    }));
  }

  function adicionarItem(catLabel) {
    const texto = novoItemTexto.trim();
    if (!texto) return;
    setLista(prev => ({
      ...prev,
      lista: prev.lista.map(c =>
        c.categoria === catLabel ? { ...c, itens: [...c.itens, texto] } : c
      ),
    }));
    setNovoItemTexto('');
    setNovoItemCat(null);
  }

  const totalItens = lista?.lista?.reduce((a, c) => a + c.itens.length, 0) ?? 0;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Lista de compras</div>
            <div className="card-sub">
              {lista ? `${totalItens} itens em ${lista.lista.length} categorias — revise e publique` : 'Gerada automaticamente ao liberar o plano'}
            </div>
          </div>
          {lista && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!editando
                ? <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => setEditando(true)}>
                    <i className="ti ti-pencil" aria-hidden="true" /> Editar lista
                  </button>
                : <button className="btn-outline" style={{ fontSize: 13 }} onClick={() => { setEditando(false); setNovoItemCat(null); }}>
                    Concluir edição
                  </button>
              }
              <button className="btn" style={{ fontSize: 13 }} onClick={publicar} disabled={busy}>
                <i className="ti ti-send" aria-hidden="true" /> {busy ? 'Publicando…' : 'Publicar lista'}
              </button>
            </div>
          )}
        </div>

        <div className="card-body">
          {!lista ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)' }}>
              <i className="ti ti-shopping-cart" style={{ fontSize: 36, display: 'block', marginBottom: 12 }} aria-hidden="true" />
              <div style={{ fontSize: 14 }}>
                A lista será gerada automaticamente ao clicar em<br />
                <strong>"Liberar para paciente"</strong> na aba Plano.
              </div>
            </div>
          ) : (
            <>
              {lista.lista.map(cat => (
                <div key={cat.categoria} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--terra)' }}>
                    <span>{cat.categoria}</span>
                    <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 4 }}>{cat.itens.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {cat.itens.map((item, i) => (
                      <span key={i} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'var(--bege)', borderRadius: 20, padding: '4px 12px',
                        fontSize: 12.5, color: 'var(--dark)',
                      }}>
                        {item}
                        {editando && (
                          <button
                            onClick={() => removerItem(cat.categoria, i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: 'var(--text3)', padding: '0 0 0 2px' }}
                            title="Remover"
                          >×</button>
                        )}
                      </span>
                    ))}
                    {editando && (
                      novoItemCat === cat.categoria
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <input
                              value={novoItemTexto}
                              onChange={e => setNovoItemTexto(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') adicionarItem(cat.categoria);
                                if (e.key === 'Escape') { setNovoItemCat(null); setNovoItemTexto(''); }
                              }}
                              placeholder="novo item…"
                              autoFocus
                              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, width: 140 }}
                            />
                            <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => adicionarItem(cat.categoria)}>+</button>
                          </span>
                        : <button
                            onClick={() => { setNovoItemCat(cat.categoria); setNovoItemTexto(''); }}
                            style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}
                          >+ adicionar</button>
                    )}
                  </div>
                </div>
              ))}

              {feedback && <FeedbackInline f={feedback} />}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, color: 'var(--text3)' }}
                  onClick={() => { setLista(null); setEditando(false); onDraftClear?.(); }}
                >
                  Descartar
                </button>
                <button className="btn" onClick={publicar} disabled={busy}>
                  <i className="ti ti-send" aria-hidden="true" /> {busy ? 'Publicando…' : 'Publicar lista'}
                </button>
              </div>
            </>
          )}

          {!lista && feedback && <FeedbackInline f={feedback} />}
        </div>
      </div>

      <HistoricoLista
        titulo="Listas publicadas"
        items={historico}
        onDelete={excluirLista}
        renderItem={(l) => (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {contarItensLista(l.dados)} itens em {l.dados?.lista?.length ?? 0} categorias
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Publicada em {dataBR(l.publicado_em)}
            </div>
          </div>
        )}
      />
    </>
  );
}

/* ============================================================
   ENVIAR PRESCRIÇÃO (upload PDF)
   ============================================================ */
function EnviarPrescricao({ pacienteId, nutriId }) {
  const [historico, setHistorico] = useState([]);
  const [tipo, setTipo] = useState('exame');
  const [titulo, setTitulo] = useState('');
  const [nota, setNota] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function carregar() {
    const { data } = await supabase
      .from('prescricoes')
      .select('id, tipo, titulo, storage_path, nota, created_at')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    setHistorico(data ?? []);
  }
  useEffect(() => { carregar(); }, [pacienteId]);

  async function enviar() {
    setFeedback(null);
    if (!arquivo) return setFeedback({ tipo: 'erro', msg: 'Selecione um arquivo PDF.' });
    if (!titulo.trim()) return setFeedback({ tipo: 'erro', msg: 'Informe um título.' });

    setBusy(true);
    const ext = arquivo.name.split('.').pop() || 'pdf';
    const path = `${pacienteId}/${Date.now()}-${titulo.trim().replace(/[^a-z0-9]/gi, '_')}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('prescricoes')
      .upload(path, arquivo, { contentType: arquivo.type });
    if (uploadErr) {
      setBusy(false);
      return setFeedback({ tipo: 'erro', msg: 'Upload falhou: ' + uploadErr.message });
    }

    const { error: insertErr } = await supabase.from('prescricoes').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
      tipo, titulo: titulo.trim(),
      storage_path: path,
      nota: nota.trim() || null,
    });
    setBusy(false);
    if (insertErr) {
      // tenta limpar o arquivo subido se o insert falhou
      await supabase.storage.from('prescricoes').remove([path]);
      return setFeedback({ tipo: 'erro', msg: 'Erro ao registrar: ' + insertErr.message });
    }
    setFeedback({ tipo: 'ok', msg: 'Prescrição enviada!' });
    setTitulo(''); setNota(''); setArquivo(null);
    const fileInput = document.getElementById('prescricao-file');
    if (fileInput) fileInput.value = '';
    carregar();
  }

  async function abrirDocumento(path) {
    const { data, error } = await supabase.storage
      .from('prescricoes').createSignedUrl(path, 60);
    if (error) return alert('Não foi possível abrir: ' + error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function remover(item) {
    if (!window.confirm(`Remover "${item.titulo}"?`)) return;
    await supabase.storage.from('prescricoes').remove([item.storage_path]);
    await supabase.from('prescricoes').delete().eq('id', item.id);
    carregar();
  }

  const TIPO_PILL = {
    exame:   { bg: 'var(--blue-bg)',   color: 'var(--blue)',   label: 'Exame' },
    laudo:   { bg: 'var(--green-bg)',  color: 'var(--green)',  label: 'Laudo' },
    receita: { bg: 'var(--orange-bg)', color: 'var(--orange)', label: 'Receita' },
  };

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Enviar prescrição</div>
            <div className="card-sub">PDF de exame, laudo ou receita — a paciente verá em "Prescrições"</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="exame">Exame (pedido)</option>
                <option value="laudo">Laudo</option>
                <option value="receita">Receita</option>
              </select>
            </div>
            <div>
              <label className="field-label">Título</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Pedido de exame T4 livre" />
            </div>
          </div>

          <label className="field-label" style={{ marginTop: 10 }}>Arquivo PDF</label>
          <input
            id="prescricao-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={e => setArquivo(e.target.files?.[0] ?? null)}
            style={{ padding: 6 }}
          />

          <label className="field-label" style={{ marginTop: 10 }}>Observação (opcional)</label>
          <textarea rows="2" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ex: trazer este pedido na próxima consulta" />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={enviar} disabled={busy || !arquivo || !titulo.trim()}>
              <i className="ti ti-upload" aria-hidden="true"></i> {busy ? 'Enviando...' : 'Enviar prescrição'}
            </button>
          </div>

          {feedback && <FeedbackInline f={feedback} />}
        </div>
      </div>

      <div className="section-label">Documentos enviados ({historico.length})</div>
      {historico.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nenhuma prescrição enviada ainda.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {historico.map((d, i) => {
            const p = TIPO_PILL[d.tipo] ?? { bg: 'var(--bg2)', color: 'var(--text3)', label: d.tipo };
            return (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i === historico.length - 1 ? 'none' : '0.5px solid #f5f0e8',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: p.bg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <i className="ti ti-file-text" style={{ fontSize: 17, color: p.color }} aria-hidden="true"></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{d.titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {p.label} · {dataBR(d.created_at)}
                  </div>
                  {d.nota && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>
                      "{d.nota}"
                    </div>
                  )}
                </div>
                <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => abrirDocumento(d.storage_path)}>
                  <i className="ti ti-eye" aria-hidden="true"></i> Ver
                </button>
                <button onClick={() => remover(d)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}
                  title="Remover">
                  <i className="ti ti-trash" style={{ fontSize: 16 }} aria-hidden="true"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ============================================================
   CÁLCULO DE GASTO ENERGÉTICO (só nutri)
   ============================================================ */
const FATORES_ATIVIDADE = [
  { v: '1.2',   l: 'Sedentária' },
  { v: '1.285', l: 'Entre sedentária e levemente ativa' },
  { v: '1.37',  l: 'Levemente ativa' },
  { v: '1.46',  l: 'Entre levemente e moderadamente ativa' },
  { v: '1.55',  l: 'Moderadamente ativa' },
  { v: '1.635', l: 'Entre moderada e muito ativa' },
  { v: '1.72',  l: 'Muito ativa' },
  { v: '1.81',  l: 'Entre muito ativa e extremamente ativa' },
  { v: '1.9',   l: 'Extremamente ativa' },
];

function CalculoEnergetico({ paciente }) {
  const { user } = useSession();
  const [peso, setPeso]         = useState('');
  const [altura, setAltura]     = useState('');
  const [idade, setIdade]       = useState('');
  const [pgcBio, setPgcBio]     = useState(null);
  const [mmBio, setMmBio]       = useState(null);
  const [carregou, setCarregou] = useState(false);
  const [sexoCalc,      setSexoCalc]      = useState('F');
  const [fatorIdx,      setFatorIdx]      = useState(2);
  const [protG,         setProtG]         = useState('');
  const [carbG,         setCarbG]         = useState('');
  const [gordG,         setGordG]         = useState('');
  const [dataCalc,      setDataCalc]      = useState(new Date().toISOString().slice(0, 10));
  const [salvandoCalc,  setSalvandoCalc]  = useState(false);
  const [salvoFeedback, setSalvoFeedback] = useState(null);

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('peso_registros')
        .select('kg, altura_cm, pgc, mm_kg')
        .eq('paciente_id', paciente.id)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.kg)        setPeso(String(data.kg));
      if (data?.altura_cm) setAltura(String(data.altura_cm));
      if (data?.pgc)       setPgcBio(data.pgc);
      if (data?.mm_kg)     setMmBio(data.mm_kg);
      setCarregou(!!(data?.kg));
    }
    if (paciente.nascimento) {
      const n = new Date(paciente.nascimento + 'T12:00:00');
      const h = new Date();
      let a = h.getFullYear() - n.getFullYear();
      if (h.getMonth() - n.getMonth() < 0 || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
      setIdade(String(a));
    }
    carregar();
  }, [paciente.id, paciente.nascimento]);

  function num(v) {
    if (v === '' || v == null) return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  }

  const p  = num(peso);
  const al = num(altura);
  const id = num(idade);

  // Mifflin-St Jeor — ambos os sexos
  const base   = (p && al && id) ? (10 * p) + (6.25 * al) - (5 * id) : null;
  const tmbH   = base !== null ? base + 5   : null; // Homem
  const tmbM   = base !== null ? base - 161 : null; // Mulher
  const pronto = tmbH !== null;

  return (
    <>
      {/* Campos de entrada */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Cálculo Energético — Mifflin-St Jeor</div>
          {carregou && (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
              Preenchido com a avaliação mais recente
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          <div>
            <label className="field-label">Peso (kg)</label>
            <input inputMode="decimal" value={peso}
              onChange={e => setPeso(e.target.value)} placeholder="ex: 65,5" />
          </div>
          <div>
            <label className="field-label">Altura (cm)</label>
            <input inputMode="decimal" value={altura}
              onChange={e => setAltura(e.target.value)} placeholder="ex: 162" />
          </div>
          <div>
            <label className="field-label">Idade (anos)</label>
            <input inputMode="numeric" value={idade}
              onChange={e => setIdade(e.target.value)} placeholder="ex: 32" />
          </div>
          {pgcBio != null && (
            <div>
              <label className="field-label" style={{ color: 'var(--green)' }}>
                <i className="ti ti-activity" style={{ fontSize: 11, marginRight: 3 }} />
                % Gordura (bio)
              </label>
              <input value={`${pgcBio}%`} readOnly style={{ background: '#f0f7e8', color: 'var(--green)', fontWeight: 600 }} />
            </div>
          )}
          {mmBio != null && (
            <div>
              <label className="field-label" style={{ color: 'var(--green)' }}>
                <i className="ti ti-activity" style={{ fontSize: 11, marginRight: 3 }} />
                Massa Magra (bio)
              </label>
              <input value={`${mmBio} kg`} readOnly style={{ background: '#f0f7e8', color: 'var(--green)', fontWeight: 600 }} />
            </div>
          )}
        </div>
      </div>

      {/* Taxa Basal — destaque */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Taxa Basal — Não coma menos que isso
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'TMB — Homem',  valor: tmbH, cor: '#185fa5' },
            { label: 'TMB — Mulher', valor: tmbM, cor: '#8b3a52' },
          ].map(({ label, valor, cor }) => (
            <div key={label} className="card" style={{ padding: '14px 18px', borderLeft: `4px solid ${cor}` }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
              {pronto ? (
                <>
                  <div style={{ fontSize: 36, fontWeight: 700, color: cor, lineHeight: 1 }}>
                    {Math.round(valor).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>kcal/dia</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                  Preencha os campos acima
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabela completa de atividade */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>TDEE por nível de atividade</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Gasto energético total diário = TMB × Fator de atividade
          </div>
        </div>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Nível de atividade</th>
              <th style={{ textAlign: 'center', width: 64 }}>Fator</th>
              <th style={{ textAlign: 'right', width: 130, color: '#185fa5' }}>Homens (kcal)</th>
              <th style={{ textAlign: 'right', width: 130, color: '#8b3a52' }}>Mulheres (kcal)</th>
            </tr>
          </thead>
          <tbody>
            {FATORES_ATIVIDADE.map((f, i) => {
              const fa = parseFloat(f.v);
              return (
                <tr key={f.v} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg2)' }}>
                  <td style={{ fontSize: 13 }}>{f.l}</td>
                  <td style={{ textAlign: 'center', fontSize: 12, fontFamily: 'monospace', color: 'var(--text3)' }}>
                    {f.v}×
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14, color: pronto ? '#185fa5' : 'var(--text3)' }}>
                    {pronto ? Math.round(tmbH * fa).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14, color: pronto ? '#8b3a52' : 'var(--text3)' }}>
                    {pronto ? Math.round(tmbM * fa).toLocaleString('pt-BR') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Salvar cálculo ── */}
      {pronto && (
        <div className="card" style={{ padding: '16px 18px', marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-device-floppy" aria-hidden="true"></i> Salvar em Evolução
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label className="field-label">Sexo</label>
              <select value={sexoCalc} onChange={e => setSexoCalc(e.target.value)}>
                <option value="F">Mulher</option>
                <option value="M">Homem</option>
              </select>
            </div>
            <div>
              <label className="field-label">Nível de atividade</label>
              <select value={fatorIdx} onChange={e => setFatorIdx(Number(e.target.value))}>
                {FATORES_ATIVIDADE.map((f, i) => (
                  <option key={f.v} value={i}>{f.l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Data</label>
              <input type="date" value={dataCalc} onChange={e => setDataCalc(e.target.value)} />
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Meta de macros (opcional)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label className="field-label">Proteína (g)</label>
              <input type="number" step="1" value={protG} onChange={e => setProtG(e.target.value)} placeholder="ex: 120" />
            </div>
            <div>
              <label className="field-label">Carboidrato (g)</label>
              <input type="number" step="1" value={carbG} onChange={e => setCarbG(e.target.value)} placeholder="ex: 180" />
            </div>
            <div>
              <label className="field-label">Gordura (g)</label>
              <input type="number" step="1" value={gordG} onChange={e => setGordG(e.target.value)} placeholder="ex: 55" />
            </div>
          </div>

          {(() => {
            const tmbCalc = sexoCalc === 'M' ? tmbH : tmbM;
            const fa = parseFloat(FATORES_ATIVIDADE[fatorIdx].v);
            const tdeeCalc = Math.round(tmbCalc * fa);
            return (
              <div style={{
                background: 'var(--bg2)', borderRadius: 6,
                padding: '8px 12px', fontSize: 12, marginBottom: 12,
                fontFamily: 'monospace', color: 'var(--dark)',
              }}>
                TMB: {Math.round(tmbCalc)} kcal ({sexoCalc === 'M' ? 'Homem' : 'Mulher'})
                {' · '}TDEE: {tdeeCalc} kcal ({FATORES_ATIVIDADE[fatorIdx].l})
                {(protG || carbG || gordG) && ` · P ${protG || '?'}g · C ${carbG || '?'}g · G ${gordG || '?'}g`}
              </div>
            );
          })()}

          <button className="btn" disabled={salvandoCalc} onClick={async () => {
            setSalvandoCalc(true);
            setSalvoFeedback(null);
            const tmbCalc = sexoCalc === 'M' ? tmbH : tmbM;
            const fa = parseFloat(FATORES_ATIVIDADE[fatorIdx].v);
            const { error } = await supabase.from('calculos_salvos').insert({
              paciente_id:      paciente.id,
              nutricionista_id: user.id,
              data:             dataCalc,
              tmb:              Math.round(tmbCalc),
              tdee:             Math.round(tmbCalc * fa),
              proteina_g:       protG !== '' ? Number(protG)  : null,
              carboidrato_g:    carbG !== '' ? Number(carbG)  : null,
              gordura_g:        gordG !== '' ? Number(gordG)  : null,
            });
            setSalvandoCalc(false);
            setSalvoFeedback(error
              ? { tipo: 'erro', msg: error.message }
              : { tipo: 'ok',  msg: 'Cálculo salvo! Já aparece no modal de Nova Consulta.' });
          }}>
            <i className="ti ti-device-floppy" aria-hidden="true"></i>{' '}
            {salvandoCalc ? 'Salvando…' : 'Salvar em Evolução'}
          </button>
          {salvoFeedback && <FeedbackInline f={salvoFeedback} />}
        </div>
      )}
    </>
  );
}

/* ============================================================
   COMPONENTES AUXILIARES
   ============================================================ */
function FeedbackInline({ f }) {
  const ok = f.tipo === 'ok';
  return (
    <div style={{
      marginTop: 10,
      background: ok ? 'var(--green-bg)' : 'var(--red-bg)',
      color: ok ? 'var(--green)' : 'var(--red)',
      padding: '8px 12px', borderRadius: 6, fontSize: 13,
    }}>
      <i className={`ti ti-${ok ? 'check' : 'alert-circle'}`} style={{ marginRight: 5 }} aria-hidden="true"></i>
      {f.msg}
    </div>
  );
}

function HistoricoLista({ titulo, items, renderItem, onDelete }) {
  return (
    <>
      <div className="section-label">{titulo} ({items.length})</div>
      {items.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nada publicado ainda.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {items.map((it, i) => (
            <div key={it.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px',
              borderBottom: i === items.length - 1 ? 'none' : '0.5px solid #f5f0e8',
            }}>
              {renderItem(it)}
              {onDelete && (
                <button onClick={() => onDelete(it)}
                  title="Excluir"
                  style={{
                    background: 'none', border: '0.5px solid var(--red)',
                    borderRadius: 6, padding: '4px 8px',
                    color: 'var(--red)', cursor: 'pointer',
                  }}>
                  <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true"></i>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function VerJsonModal({ item, dados, onClose }) {
  const pretty = JSON.stringify(dados, null, 2);
  async function copiar() {
    try { await navigator.clipboard.writeText(pretty); alert('Copiado!'); }
    catch (e) { alert('Não foi possível copiar.'); }
  }
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(28,23,18,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 12, padding: 22,
        width: 600, maxWidth: '90vw', maxHeight: '85vh',
        border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17 }}>JSON publicado</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={copiar}>
              <i className="ti ti-copy" aria-hidden="true"></i> Copiar
            </button>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
        <pre style={{
          background: 'var(--bg2)', padding: 12, borderRadius: 8,
          fontSize: 12, lineHeight: 1.5, overflow: 'auto', flex: 1,
          fontFamily: 'monospace', color: 'var(--dark)',
        }}>{pretty}</pre>
      </div>
    </div>
  );
}


/* ============================================================
   E-BOOKS DA PACIENTE
   ============================================================ */
const EBOOK_TAGS = [
  { id: 'receitas',      label: 'Receitas'       },
  { id: 'guia',          label: 'Guia'           },
  { id: 'protocolo',     label: 'Protocolo'      },
  { id: 'suplementacao', label: 'Suplementação'  },
  { id: 'outro',         label: 'Outro'          },
];

function EbooksDaPaciente({ pacienteId, nutriId, pacienteNome }) {
  const [todos, setTodos] = useState([]);          // todos os ebooks da nutri
  const [atribuidosIds, setAtribuidosIds] = useState(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busca, setBusca] = useState('');

  async function carregar() {
    const [ebRes, atRes] = await Promise.all([
      supabase.from('ebooks').select('*').eq('nutri_id', nutriId).order('created_at', { ascending: false }),
      supabase.from('ebooks_pacientes').select('ebook_id').eq('paciente_id', pacienteId),
    ]);
    setTodos(ebRes.data ?? []);
    setAtribuidosIds(new Set((atRes.data ?? []).map(a => a.ebook_id)));
  }
  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  async function toggle(ebookId) {
    if (atribuidosIds.has(ebookId)) {
      await supabase.from('ebooks_pacientes').delete()
        .eq('ebook_id', ebookId).eq('paciente_id', pacienteId);
    } else {
      await supabase.from('ebooks_pacientes').insert({
        ebook_id: ebookId, paciente_id: pacienteId,
      });
    }
    carregar();
  }

  async function abrir(eb) {
    const { data, error } = await supabase.storage
      .from('ebooks').createSignedUrl(eb.storage_path, 120);
    if (error) return alert('Não foi possível abrir: ' + error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  const atribuidos = todos.filter(e => atribuidosIds.has(e.id));
  const disponiveis = todos.filter(e => !atribuidosIds.has(e.id))
    .filter(e => {
      if (!busca.trim()) return true;
      const q = busca.trim().toLowerCase();
      return (e.titulo ?? '').toLowerCase().includes(q)
        || (e.descricao ?? '').toLowerCase().includes(q);
    });

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">E-books de {pacienteNome.split(' ')[0]}</div>
            <div className="card-sub">Marque os materiais da biblioteca que ela pode acessar, ou suba um novo direto</div>
          </div>
          <button className="btn" onClick={() => setUploadOpen(true)}>
            <i className="ti ti-upload" aria-hidden="true"></i> Subir novo
          </button>
        </div>
        <div className="card-body">
          <div style={{
            fontSize: 10, letterSpacing: 1, color: 'var(--text3)',
            textTransform: 'uppercase', fontWeight: 500, marginBottom: 8,
          }}>
            Materiais atribuídos ({atribuidos.length})
          </div>
          {atribuidos.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 8, background: 'var(--bg2)',
              fontSize: 12, color: 'var(--text3)', marginBottom: 14,
            }}>
              Nenhum e-book atribuído ainda. Marque um da biblioteca abaixo ou suba um novo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {atribuidos.map(eb => (
                <div key={eb.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, borderRadius: 8,
                  background: 'var(--green-bg, var(--bg2))',
                  border: '0.5px solid var(--green, var(--border))',
                }}>
                  <i className="ti ti-check" style={{ fontSize: 16, color: 'var(--green)' }} aria-hidden="true"></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{eb.titulo}</div>
                    {eb.descricao && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{eb.descricao}</div>
                    )}
                  </div>
                  <button onClick={() => abrir(eb)} className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                    <i className="ti ti-eye" aria-hidden="true"></i> Abrir
                  </button>
                  <button onClick={() => toggle(eb.id)}
                    style={{
                      background: 'none', border: '0.5px solid var(--red)',
                      borderRadius: 6, padding: '4px 8px',
                      color: 'var(--red)', cursor: 'pointer',
                    }}
                    title="Remover acesso">
                    <i className="ti ti-x" aria-hidden="true"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Disponíveis na biblioteca */}
          <div style={{
            fontSize: 10, letterSpacing: 1, color: 'var(--text3)',
            textTransform: 'uppercase', fontWeight: 500, marginBottom: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Disponíveis na biblioteca ({todos.length - atribuidos.length})</span>
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar..."
              style={{ width: 180, padding: '4px 8px', fontSize: 11, margin: 0 }}
            />
          </div>
          {todos.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 8, background: 'var(--bg2)',
              fontSize: 12, color: 'var(--text3)',
            }}>
              Sua biblioteca está vazia. Suba o primeiro e-book pelo menu "Biblioteca" ou pelo botão acima.
            </div>
          ) : disponiveis.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>
              Nenhum e-book disponível com esses filtros.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {disponiveis.map(eb => {
                const tag = EBOOK_TAGS.find(t => t.id === (eb.tag ?? 'outro'));
                return (
                  <div key={eb.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 10, borderRadius: 8,
                    background: 'var(--white)',
                    border: '0.5px solid var(--border)',
                  }}>
                    <i className="ti ti-file-text" style={{ fontSize: 16, color: 'var(--text3)' }} aria-hidden="true"></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{eb.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {tag?.label ?? 'Outro'}{eb.descricao && ` · ${eb.descricao.slice(0, 60)}${eb.descricao.length > 60 ? '...' : ''}`}
                      </div>
                    </div>
                    <button onClick={() => abrir(eb)} className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}>
                      <i className="ti ti-eye" aria-hidden="true"></i> Ver
                    </button>
                    <button onClick={() => toggle(eb.id)} className="btn" style={{ fontSize: 11, padding: '4px 10px' }}>
                      <i className="ti ti-plus" aria-hidden="true"></i> Atribuir
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <ModalUploadEbookPaciente
          nutriId={nutriId} pacienteId={pacienteId}
          onClose={() => setUploadOpen(false)}
          onSaved={() => { setUploadOpen(false); carregar(); }}
        />
      )}
    </>
  );
}


function ModalUploadEbookPaciente({ nutriId, pacienteId, onClose, onSaved }) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tag, setTag] = useState('guia');
  const [arquivo, setArquivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);

  async function enviar() {
    setErro(null);
    if (!arquivo) return setErro('Selecione um arquivo PDF.');
    if (!titulo.trim()) return setErro('Informe um título.');
    setBusy(true);
    const ext = (arquivo.name.split('.').pop() || 'pdf').toLowerCase();
    const path = `${nutriId}/${Date.now()}-${titulo.trim().replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    const { error: upErr } = await supabase.storage.from('ebooks')
      .upload(path, arquivo, { contentType: arquivo.type });
    if (upErr) { setBusy(false); return setErro('Upload falhou: ' + upErr.message); }

    const { data: insData, error: insErr } = await supabase.from('ebooks').insert({
      nutri_id: nutriId,
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      tag, storage_path: path,
    }).select().single();
    if (insErr) {
      await supabase.storage.from('ebooks').remove([path]);
      setBusy(false);
      return setErro('Erro: ' + insErr.message);
    }
    // Já atribui à paciente atual
    await supabase.from('ebooks_pacientes').insert({
      ebook_id: insData.id, paciente_id: pacienteId,
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 12,
        maxWidth: 480, width: '100%', maxHeight: '90vh',
        overflow: 'auto', padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Subir e-book pra essa paciente</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Vai pra biblioteca e já atribui automaticamente
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--text3)', padding: 4,
          }}><i className="ti ti-x" aria-hidden="true"></i></button>
        </div>

        <label className="form-lbl">Arquivo (PDF)</label>
        <input type="file" accept="application/pdf" onChange={e => setArquivo(e.target.files?.[0] ?? null)}
          style={{ padding: 6 }} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {arquivo ? `${arquivo.name} · ${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : 'Nenhum arquivo selecionado'}
        </div>

        <label className="form-lbl" style={{ marginTop: 12 }}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Cardápio especial low-carb" />

        <label className="form-lbl" style={{ marginTop: 12 }}>Categoria</label>
        <select value={tag} onChange={e => setTag(e.target.value)}>
          {EBOOK_TAGS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        <label className="form-lbl" style={{ marginTop: 12 }}>Descrição (opcional)</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 64 }} />

        {erro && (
          <div style={{
            background: 'var(--red-bg)', color: 'var(--red)',
            padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 10,
          }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={enviar} disabled={busy || !arquivo}>
            <i className="ti ti-upload" aria-hidden="true"></i> {busy ? 'Enviando...' : 'Subir e atribuir'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MINHA SEMANA — relatórios semanais enviados pela paciente
   ============================================================ */
function MinhaSemana({ pacienteId }) {
  const [relatorios, setRelatorios] = useState(null);
  const [abertos, setAbertos] = useState(new Set());

  useEffect(() => {
    supabase
      .from('relatorio_semanal')
      .select('id, resposta, respondido_em')
      .eq('paciente_id', pacienteId)
      .order('respondido_em', { ascending: false })
      .then(({ data }) => setRelatorios(data ?? []));
  }, [pacienteId]);

  function toggle(id) {
    setAbertos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function fmtData(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (relatorios === null) {
    return (
      <div className="card empty-card">
        <div className="empty-sub">Carregando relatórios…</div>
      </div>
    );
  }

  if (relatorios.length === 0) {
    return (
      <div className="card empty-card">
        <i className="ti ti-calendar-week" style={{ fontSize: 32, color: 'var(--text3)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
        <div className="empty-sub">Nenhum relatório enviado ainda.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {relatorios.map(r => {
        const aberto = abertos.has(r.id);
        return (
          <div
            key={r.id}
            className="card"
            style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => toggle(r.id)}
          >
            {/* Cabeçalho — sempre visível */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
                {fmtData(r.respondido_em)}
              </div>
              <i
                className={`ti ti-chevron-${aberto ? 'up' : 'down'}`}
                style={{ fontSize: 14, color: 'var(--text3)' }}
                aria-hidden="true"
              />
            </div>

            {/* Conteúdo expansível */}
            {aberto && (
              <div style={{
                padding: '0 18px 16px',
                borderTop: '0.5px solid var(--border)',
              }}>
                <div style={{
                  marginTop: 12,
                  fontSize: 13, color: 'var(--dark)', lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                }}>
                  {r.resposta || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Sem texto</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   HÁBITOS DO MÊS — visualização em modo leitura para a nutri
   ============================================================ */
function HabitosMesNutri({ pacienteId }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [registro, setRegistro] = useState(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [editHabitos, setEditHabitos] = useState([]);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from('habitos_mes').select('*')
      .eq('paciente_id', pacienteId).eq('ano', ano).eq('mes', mes)
      .maybeSingle();
    setRegistro(data ?? null);
  }

  useEffect(() => {
    let active = true;
    setRegistro(undefined);
    supabase.from('habitos_mes').select('*')
      .eq('paciente_id', pacienteId).eq('ano', ano).eq('mes', mes)
      .maybeSingle()
      .then(({ data }) => { if (active) setRegistro(data ?? null); });
    return () => { active = false; };
  }, [pacienteId, ano, mes]);

  function navMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a);
  }

  function abrirEdicao() {
    setEditHabitos([...(registro?.habitos?.length ? registro.habitos : HABITOS_PADRAO)]);
    setEditOpen(true);
  }

  async function salvarEdicao() {
    const limpos = editHabitos.map(h => h.trim()).filter(Boolean);
    setSalvando(true);
    await supabase.from('habitos_mes').upsert({
      paciente_id: pacienteId,
      ano, mes,
      habitos: limpos,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'paciente_id,ano,mes' });
    setSalvando(false);
    setEditOpen(false);
    carregar();
  }

  if (registro === undefined) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const habitos = registro?.habitos?.length ? registro.habitos : HABITOS_PADRAO;
  const checks = registro?.checks ?? {};
  const campos = registro?.campos ?? {};
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const isMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>
          Hábitos do mês
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={CAL_NAV_BTN} onClick={() => navMes(-1)} aria-label="mês anterior">
            <i className="ti ti-chevron-left" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 138, textAlign: 'center' }}>
            {MESES[mes - 1]} {ano}
          </span>
          <button style={CAL_NAV_BTN} onClick={() => navMes(1)} aria-label="próximo mês">
            <i className="ti ti-chevron-right" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
          <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px', marginLeft: 6 }} onClick={abrirEdicao}>
            <i className="ti ti-edit" aria-hidden="true"></i> Editar hábitos
          </button>
        </div>
      </div>

      {(campos.nome || campos.data_inicio || campos.peso_inicio || campos.peso_final) && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
          {campos.nome && <span><strong>Nome:</strong> {campos.nome}</span>}
          {campos.data_inicio && <span><strong>Início:</strong> {dataBR(campos.data_inicio)}</span>}
          {campos.peso_inicio && <span><strong>Peso início:</strong> {campos.peso_inicio} kg</span>}
          {campos.peso_final && <span><strong>Peso final:</strong> {campos.peso_final} kg</span>}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: dias.length * 28 + 160 }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, padding: '0 2px 8px', textAlign: 'left', minWidth: 150, position: 'sticky', left: 0, background: 'var(--white)' }}></th>
              {dias.map(d => {
                const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isHoje = isMesAtual && iso === hojeISO;
                return (
                  <th key={d} style={{ fontSize: 10, padding: '0 2px 8px', textAlign: 'center', minWidth: 24, color: isHoje ? 'var(--dark)' : '#aaa', fontWeight: isHoje ? 700 : 500 }}>
                    {d}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {habitos.map((h, hi) => (
              <tr key={hi}>
                <td style={{ fontSize: 12, color: 'var(--dark)', padding: '6px 10px 6px 0', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--white)' }}>
                  {h}
                </td>
                {dias.map(d => {
                  const marcado = !!checks[String(hi)]?.[String(d)];
                  return (
                    <td key={d} style={{ padding: 2, textAlign: 'center' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, margin: '0 auto',
                        background: marcado ? 'var(--dark)' : 'transparent',
                        border: marcado ? 'none' : '0.5px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {marcado && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true"></i>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(28,23,18,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setEditOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--white)', borderRadius: 12, padding: 22,
            width: 460, maxWidth: '90vw', maxHeight: '85vh',
            border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, marginBottom: 14 }}>Editar hábitos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', marginBottom: 14, flex: 1 }}>
              {editHabitos.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={h}
                    onChange={e => setEditHabitos(arr => arr.map((x, xi) => xi === i ? e.target.value : x))}
                    style={{
                      flex: 1, padding: '8px 10px', fontSize: 13,
                      border: '0.5px solid var(--border)', borderRadius: 8,
                      fontFamily: 'var(--font-sans)',
                    }}
                  />
                  <button onClick={() => setEditHabitos(arr => arr.filter((_, xi) => xi !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4 }}>
                    <i className="ti ti-trash" aria-hidden="true"></i>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setEditHabitos(arr => [...arr, ''])} style={{
              background: 'none', border: '1px dashed var(--border)', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer',
              width: '100%', marginBottom: 14, fontFamily: 'var(--font-sans)',
            }}>+ Adicionar hábito</button>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => setEditOpen(false)}>Cancelar</button>
              <button className="btn" onClick={salvarEdicao} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
