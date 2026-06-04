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
import FollowUp from './_FollowUp.jsx';
import Suplementacao from './_Suplementacao.jsx';
import Habitos from './_Habitos.jsx';
import Anamnese from './_Anamnese.jsx';
import DicaJSON from '../../components/DicaJSON.jsx';
import { SUBS_GRUPOS } from '../../lib/subsData.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

export default function PacientePerfil() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [paciente, setPaciente] = useState(null);
  const [tab, setTab] = useState('plano');
  const [subsSel, setSubsSel] = useState(new Set());
  const [editandoNasc, setEditandoNasc] = useState(false);
  const [novoNasc, setNovoNasc] = useState('');
  const [salvandoNasc, setSalvandoNasc] = useState(false);

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
          <div className="page-title" style={{ marginBottom: 2 }}>{paciente.nome}</div>
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

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, background: 'var(--bg2)',
        borderRadius: 10, padding: 3, marginBottom: 16,
        overflowX: 'auto', scrollbarWidth: 'thin',
      }}>
        {[
          { id: 'evolucao',    label: 'Evolução',     icon: 'chart-line' },
          { id: 'anamnese',    label: 'Anamnese',     icon: 'clipboard-text' },
          { id: 'calculo',     label: 'Cálculo',      icon: 'calculator' },
          { id: 'followup',    label: 'Follow-up',    icon: 'notebook' },
          { id: 'plano',          label: 'Plano',          icon: 'salad' },
          { id: 'substituicoes', label: 'Substituições', icon: 'replace' },
          { id: 'pdf-final',     label: 'PDF Final',      icon: 'file-certificate' },
          { id: 'compras',       label: 'Compras',        icon: 'shopping-cart' },
          { id: 'suplementacao', label: 'Suplementação', icon: 'pill' },
          { id: 'habitos',       label: 'Hábitos',       icon: 'checklist' },
          { id: 'prescricoes', label: 'Prescrições',  icon: 'file-text' },
          { id: 'ebooks',      label: 'E-books',      icon: 'book-2' },
          { id: 'avaliacao',   label: 'Avaliação',    icon: 'ruler-measure' },
          { id: 'checkin',     label: 'Check-in',     icon: 'clipboard-check' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: '0 0 auto',
              padding: '7px 12px', fontSize: 13, fontWeight: 500,
              borderRadius: 8, border: 'none', cursor: 'pointer',
              color: tab === t.id ? 'var(--dark)' : 'var(--text3)',
              background: tab === t.id ? 'var(--white)' : 'transparent',
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

      {tab === 'evolucao' && <Evolucao pacienteId={paciente.id} paciente={paciente} nutriId={user.id} />}
      {tab === 'anamnese' && <Anamnese pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'calculo'  && <CalculoEnergetico paciente={paciente} />}
      {tab === 'followup' && <FollowUp pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'suplementacao' && <Suplementacao pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'habitos' && <Habitos pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'plano' && <PublicarPlano pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'substituicoes' && <Substituicoes pacienteId={paciente.id} pacienteNome={paciente.nome} selecionados={subsSel} setSelecionados={setSubsSel} />}
      {tab === 'pdf-final' && <PdfFinal pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} subsSelecionadas={subsSel} />}
      {tab === 'compras' && <PublicarLista pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'prescricoes' && <EnviarPrescricao pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'ebooks' && <EbooksDaPaciente pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
      {tab === 'avaliacao' && <RegistrarAvaliacao pacienteId={paciente.id} nutriId={user.id} />}
      {tab === 'checkin' && <CheckinPersonalizado pacienteId={paciente.id} nutriId={user.id} pacienteNome={paciente.nome} />}
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
   SUBSTITUIÇÕES ALIMENTARES
   ============================================================ */

const _escHtmlSubs = s =>
  String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');


function _normSubs(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\d+\s*(g|ml|kg)\b/gi, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _bateComSub(nomeAlimento, itemSub) {
  const STOP = new Set(['de','da','do','com','sem','em','ou','ja','por','um','uma','tipo','zero','light','fit']);
  const kw = s => _normSubs(s).split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w));
  const k1 = kw(nomeAlimento), k2 = kw(itemSub);
  return k1.length > 0 && k2.length > 0 && k1.some(w => k2.includes(w));
}

function _presSelecionarSubs(plano, setSelecionados) {
  const nomes = [];
  for (const ref of (plano.refeicoes ?? [])) {
    for (const al of (ref.alimentos ?? [])) {
      if (al.nome) nomes.push(al.nome);
      for (const sub of (al.subs ?? [])) {
        const n = typeof sub === 'string' ? sub : sub?.nome;
        if (n) nomes.push(n);
      }
    }
  }
  if (!nomes.length) return;
  const novos = new Set();
  for (const grupo of SUBS_GRUPOS) {
    for (const cat of grupo.categorias) {
      cat.itens.forEach((item, i) => {
        if (nomes.some(n => _bateComSub(n, item))) novos.add(`${cat.id}|${i}`);
      });
    }
  }
  setSelecionados(novos);
}

function Substituicoes({ pacienteId, pacienteNome, selecionados, setSelecionados }) {
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setCarregando(true);
      const { data } = await supabase
        .from('planos')
        .select('dados')
        .eq('paciente_id', pacienteId)
        .order('publicado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      // só pré-seleciona se o estado ainda estiver vazio (preserva seleções manuais)
      if (data?.dados && selecionados.size === 0) _presSelecionarSubs(data.dados, setSelecionados);
      setCarregando(false);
    }
    load();
    return () => { active = false; };
  }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(catId, idx) {
    setSelecionados(prev => {
      const next = new Set(prev);
      const k = `${catId}|${idx}`;
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function marcarTodosCat(cat) {
    setSelecionados(prev => {
      const next = new Set(prev);
      cat.itens.forEach((_, i) => next.add(`${cat.id}|${i}`));
      return next;
    });
  }

  function limparCat(cat) {
    setSelecionados(prev => {
      const next = new Set(prev);
      cat.itens.forEach((_, i) => next.delete(`${cat.id}|${i}`));
      return next;
    });
  }

  function gerarPDF() {
    const secoes = SUBS_GRUPOS.map(grupo => {
      const catsHtml = grupo.categorias.map(cat => {
        const itens = cat.itens.filter((_, i) => selecionados.has(`${cat.id}|${i}`));
        if (!itens.length) return '';
        return `<div class="cat"><div class="cat-label">${_escHtmlSubs(cat.label)}</div><ul>${
          itens.map(it => `<li>${_escHtmlSubs(it)}</li>`).join('')
        }</ul></div>`;
      }).join('');
      if (!catsHtml.trim()) return '';
      return `<div class="grupo"><div class="grupo-titulo">${_escHtmlSubs(grupo.refeicao)}</div>${catsHtml}</div>`;
    }).join('');

    if (!secoes.trim()) { alert('Selecione pelo menos um alimento antes de gerar o PDF.'); return; }

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para gerar o PDF.'); return; }
    win.document.write(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Substituições · ${_escHtmlSubs(pacienteNome ?? '')}</title>
<style>
@page{size:A4;margin:20mm}
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#2b2b2b;max-width:680px;margin:0 auto;font-size:13px}
h1{font-size:20px;margin:0 0 4px;color:#1a1a1a}
.meta{font-size:11px;color:#888;margin-bottom:26px}
.header{border-bottom:2px solid #c9a96e;padding-bottom:14px;margin-bottom:20px}
.intro{font-size:12px;color:#555;background:#faf7f2;padding:10px 14px;border-radius:6px;margin-bottom:22px;line-height:1.6}
.grupo{margin-bottom:22px;page-break-inside:avoid}
.grupo-titulo{font-size:13px;font-weight:700;color:#c9a96e;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e8dcc8;padding-bottom:4px;margin-bottom:10px}
.cat{margin-bottom:10px;padding-left:8px}
.cat-label{font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
ul{margin:0;padding-left:16px}
li{margin-bottom:3px;font-size:13px;line-height:1.5}
.footer{margin-top:30px;font-size:10px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}
</style></head>
<body>
<div class="header"><h1>Substituições Alimentares</h1>
<div class="meta">Paciente: <strong>${_escHtmlSubs(pacienteNome ?? '')}</strong></div></div>
<div class="intro">Escolha <strong>uma opção por categoria</strong> em cada refeição. Mantenha as quantidades indicadas e prefira alimentos frescos e minimamente processados.</div>
${secoes}
<div class="footer">Gerado pela Lapidare</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`);
    win.document.close();
  }

  const total = selecionados.size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Barra de ações global */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Substituições Alimentares</div>
            <div className="card-sub">
              {carregando
                ? 'Carregando plano ativo...'
                : `${total} item${total !== 1 ? 's' : ''} selecionado${total !== 1 ? 's' : ''}. Edite livremente e gere o PDF para a paciente.`}
            </div>
          </div>
          <button className="btn" onClick={gerarPDF} disabled={total === 0 || carregando}>
            <i className="ti ti-download" aria-hidden="true"></i> Gerar PDF
          </button>
        </div>
      </div>

      {/* Um card por refeição */}
      {SUBS_GRUPOS.map(grupo => {
        const totalGrupo = grupo.categorias.reduce((acc, cat) =>
          acc + cat.itens.filter((_, i) => selecionados.has(`${cat.id}|${i}`)).length, 0);

        return (
          <div key={grupo.refeicao} className="card" style={{ overflow: 'hidden', padding: 0 }}>

            {/* Header da refeição */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg2, #faf7f2)',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--dark)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {grupo.refeicao}
              </div>
              {totalGrupo > 0 && (
                <span style={{
                  fontSize: 11, color: '#c9a96e', fontWeight: 600,
                  background: '#fdf3ee', borderRadius: 20,
                  padding: '2px 10px',
                }}>
                  {totalGrupo} selecionado{totalGrupo !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Categorias */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            }}>
              {grupo.categorias.map((cat, ci) => {
                const allChk = cat.itens.every((_, i) => selecionados.has(`${cat.id}|${i}`));
                const anyChk = cat.itens.some((_, i) => selecionados.has(`${cat.id}|${i}`));
                const selCount = cat.itens.filter((_, i) => selecionados.has(`${cat.id}|${i}`)).length;

                return (
                  <div key={cat.id} style={{
                    borderRight: ci % 2 === 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {/* Header da categoria */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '10px 16px 8px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: '#c9a96e', flex: 1,
                      }}>
                        {cat.label}
                        {selCount > 0 && (
                          <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 5 }}>
                            ({selCount}/{cat.itens.length})
                          </span>
                        )}
                      </span>
                      {!allChk && (
                        <button onClick={() => marcarTodosCat(cat)} style={{
                          background: 'none', border: '0.5px solid var(--border)',
                          borderRadius: 4, cursor: 'pointer',
                          fontSize: 10, color: 'var(--text3)', padding: '1px 7px',
                          lineHeight: '16px',
                        }}>todos</button>
                      )}
                      {anyChk && (
                        <button onClick={() => limparCat(cat)} style={{
                          background: 'none', border: '0.5px solid var(--border)',
                          borderRadius: 4, cursor: 'pointer',
                          fontSize: 10, color: 'var(--red)', padding: '1px 7px',
                          lineHeight: '16px',
                        }}>limpar</button>
                      )}
                    </div>

                    {/* Lista de itens */}
                    <div>
                      {cat.itens.map((item, idx) => {
                        const key = `${cat.id}|${idx}`;
                        const chk = selecionados.has(key);
                        return (
                          <label key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 16px',
                            borderBottom: idx < cat.itens.length - 1
                              ? '0.5px solid var(--border)' : 'none',
                            cursor: 'pointer',
                            background: chk ? '#fffbf6' : 'transparent',
                            transition: 'background 0.1s',
                          }}>
                            <input
                              type="checkbox"
                              checked={chk}
                              onChange={() => toggle(cat.id, idx)}
                              style={{ flexShrink: 0, accentColor: '#c9a96e', cursor: 'pointer', margin: 0 }}
                            />
                            <span style={{
                              fontSize: 13,
                              color: chk ? 'var(--dark)' : 'var(--text3)',
                              fontWeight: chk ? 500 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }} title={item}>
                              {item}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   PDF FINAL DO PLANO
   ============================================================ */

const _DADOS_PDF_DEFAULT = {
  capa_info: '',
  capa_objetivo: '',
  consulta_info: '',
  dados_paciente: '',
  validade: '',
  sugestoes: [],
  notas: [],
  prioridades: '',
  metas: '',
  suplementos: '',
  orientacoes_gerais: '',
  alimentos_reduzir: '',
  obs_personalizadas: '',
  atencao: '',
  frase_encerramento: '"Quem você quer ser é inegociável."',
  vegetais_liberados: 'Acelga, Agrião, Alface, Almeirão, Abobrinha, Berinjela, Beterraba, Brócolis, Cebola, Cenoura, Chicória, Chuchu, Couve, Couve-flor, Cogumelo, Espinafre, Maxixe, Nabo, Pepino, Pimentão, Quiabo, Rabanete, Repolho, Rúcula, Tomate',
};

function PdfFinal({ pacienteId, nutriId, pacienteNome, subsSelecionadas }) {
  const [plano, setPlano] = useState(null);
  const [dados, setDados] = useState({ ..._DADOS_PDF_DEFAULT });
  const [idRascunho, setIdRascunho] = useState(null);
  const [publicado, setPublicado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [nutriInfo, setNutriInfo] = useState({ nome: '', crn: '', email: '' });

  useEffect(() => {
    let active = true;
    async function load() {
      const [planRes, draftRes, nutriRes] = await Promise.all([
        supabase.from('planos').select('dados, validade')
          .eq('paciente_id', pacienteId)
          .order('publicado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('planos_visuais').select('*')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('nutris').select('nome, crn, email').eq('id', nutriId).maybeSingle(),
      ]);
      if (!active) return;

      const planDados = planRes.data?.dados ?? null;
      setPlano(planDados);

      if (draftRes.data) {
        setIdRascunho(draftRes.data.id);
        setPublicado(draftRes.data.publicado ?? false);
        setDados({ ..._DADOS_PDF_DEFAULT, ...draftRes.data.dados });
      } else if (planDados) {
        const refsLen = planDados.refeicoes?.length ?? 0;
        setDados(prev => ({
          ...prev,
          validade: planRes.data.validade
            ? new Date(planRes.data.validade).toLocaleDateString('pt-BR') : '',
          sugestoes: Array(refsLen).fill(''),
          notas: Array(refsLen).fill(''),
        }));
      }

      if (nutriRes.data) setNutriInfo(nutriRes.data);
    }
    load();
    return () => { active = false; };
  }, [pacienteId, nutriId]);

  const set = (key, value) => setDados(prev => ({ ...prev, [key]: value }));

  async function salvar(publicar = false) {
    setBusy(true);
    setFeedback(null);
    const payload = {
      paciente_id: pacienteId,
      nutri_id: nutriId,
      dados: {
        ...dados,
        subs_selecionadas: Object.fromEntries([...subsSelecionadas].map(k => [k, true])),
      },
      publicado: publicar,
      publicado_em: publicar ? new Date().toISOString() : null,
    };
    let error, newId;
    if (idRascunho) {
      ({ error } = await supabase.from('planos_visuais').update(payload).eq('id', idRascunho));
    } else {
      const res = await supabase.from('planos_visuais').insert(payload).select('id').single();
      error = res.error;
      newId = res.data?.id;
    }
    setBusy(false);
    if (error) {
      if (error.code === '42P01') {
        return setFeedback({ tipo: 'erro', msg: 'Tabela planos_visuais não existe. Execute o SQL de migração no Supabase (seção 14 do setup.sql).' });
      }
      return setFeedback({ tipo: 'erro', msg: error.message });
    }
    if (newId) setIdRascunho(newId);
    if (publicar) setPublicado(true);
    setFeedback({ tipo: 'ok', msg: publicar ? 'Plano liberado! A paciente já pode ver.' : 'Rascunho salvo.' });
  }

  function visualizar() {
    if (!plano) { alert('Publique um plano na aba Plano primeiro.'); return; }
    const html = gerarPlanoHtml({
      pacienteNome,
      plano,
      extras: dados,
      subsSelecionadas,
      nutriNome: nutriInfo.nome,
      nutriCrn: nutriInfo.crn,
      nutriEmail: nutriInfo.email,
    });
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para visualizar o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  const refeicoes = plano?.refeicoes ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Cabeçalho com botões */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">PDF Final do Plano</div>
            <div className="card-sub">
              {publicado
                ? '✓ Plano liberado para a paciente.'
                : 'Preencha, visualize e libere o plano personalizado.'}
              {subsSelecionadas.size > 0
                ? ` · ${subsSelecionadas.size} substituições da aba anterior incluídas.`
                : ' · Selecione substituições na aba anterior.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-outline" onClick={() => salvar(false)} disabled={busy}>
              <i className="ti ti-device-floppy" aria-hidden="true"></i> Salvar rascunho
            </button>
            <button className="btn-outline" onClick={visualizar}>
              <i className="ti ti-eye" aria-hidden="true"></i> Visualizar PDF
            </button>
            <button className="btn" onClick={() => salvar(true)} disabled={busy || !plano}>
              <i className="ti ti-send" aria-hidden="true"></i> Liberar para paciente
            </button>
          </div>
        </div>
        {feedback && <FeedbackInline f={feedback} />}
        {!plano && (
          <div style={{ padding: '10px 20px', fontSize: 13, color: 'var(--text3)' }}>
            ⚠ Nenhum plano publicado encontrado. Publique um plano na aba <strong>Plano</strong> primeiro.
          </div>
        )}
      </div>

      {/* Capa e dados da paciente */}
      <div className="card">
        <div className="card-header"><div className="card-title">Capa e Dados da Paciente</div></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="field-label">Linha de perfil</label>
            <input value={dados.capa_info} onChange={e => set('capa_info', e.target.value)}
              placeholder="32 anos · Designer · 74kg · 1,65m · IMC 27,2" />
          </div>
          <div>
            <label className="field-label">Objetivo</label>
            <input value={dados.capa_objetivo} onChange={e => set('capa_objetivo', e.target.value)}
              placeholder="Emagrecimento + Controle do Inchaço · SOP · Anti-inflamatório" />
          </div>
          <div>
            <label className="field-label">Info da consulta</label>
            <input value={dados.consulta_info} onChange={e => set('consulta_info', e.target.value)}
              placeholder={`Consulta Nº 01 · ${new Date().toLocaleDateString('pt-BR')} · Nutricionista ${nutriInfo.nome || '…'} | CRN ${nutriInfo.crn || '…'}`} />
          </div>
          <div>
            <label className="field-label">Dados clínicos (1 dado por linha, aparece no lado esquerdo da capa)</label>
            <textarea value={dados.dados_paciente} onChange={e => set('dados_paciente', e.target.value)}
              rows={6} placeholder={'Peso: 74kg | Altura: 1,65m\nIMC: 27,2 — Sobrepeso leve\n% Gordura: 35% · MLG: 48,1kg\nCirc. Abdominal: 88cm\nRetorno: 30 dias'} />
          </div>
          <div>
            <label className="field-label">Validade do plano (ex: 03/07/2026)</label>
            <input value={dados.validade} onChange={e => set('validade', e.target.value)}
              placeholder="03/07/2026" style={{ maxWidth: 200 }} />
          </div>
        </div>
      </div>

      {/* Sugestão e nota por refeição */}
      {refeicoes.length > 0 && (
        <div className="card">
          <div className="card-header"><div className="card-title">Sugestão da Nutri por Refeição</div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {refeicoes.map((ref, i) => (
              <div key={i} style={{ borderBottom: i < refeicoes.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i < refeicoes.length - 1 ? 18 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>
                  {ref.emoji ?? ''} {ref.nome}
                  {ref.horario ? <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11, marginLeft: 8 }}>{ref.horario}</span> : null}
                </div>
                <label className="field-label">Sugestão da nutri</label>
                <textarea
                  value={dados.sugestoes?.[i] ?? ''}
                  onChange={e => {
                    const a = [...(dados.sugestoes ?? Array(refeicoes.length).fill(''))];
                    a[i] = e.target.value;
                    set('sugestoes', a);
                  }}
                  rows={2}
                  placeholder={`Sugestão personalizada para ${ref.nome}...`}
                />
                <label className="field-label" style={{ marginTop: 6 }}>Nota de destaque (aparece em laranja)</label>
                <input
                  value={dados.notas?.[i] ?? ''}
                  onChange={e => {
                    const a = [...(dados.notas ?? Array(refeicoes.length).fill(''))];
                    a[i] = e.target.value;
                    set('notas', a);
                  }}
                  placeholder="Ex: O farelo de aveia tem função além da fibra — ajuda no controle glicêmico..."
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prioridades / Metas / Suplementos */}
      <div className="card">
        <div className="card-header"><div className="card-title">Prioridades, Metas e Suplementos</div></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Prioridades (1 por linha → vira bullet)</label>
            <textarea value={dados.prioridades} onChange={e => set('prioridades', e.target.value)} rows={8}
              placeholder={'Não pular o almoço — essa refeição é inegociável\nProteína em todas as 5 refeições, sem exceção\nNada de açúcar simples isolado — sempre com fibra ou proteína'} />
          </div>
          <div>
            <label className="field-label">Metas (1 por linha)</label>
            <textarea value={dados.metas} onChange={e => set('metas', e.target.value)} rows={6}
              placeholder={'Reduzir circunferência abdominal de 88cm → meta 83cm em 60 dias\nEvacuar pelo menos 1x/dia em 2 semanas'} />
          </div>
          <div>
            <label className="field-label">Suplementos (1 por linha)</label>
            <textarea value={dados.suplementos} onChange={e => set('suplementos', e.target.value)} rows={5}
              placeholder={'Ômega-3 — 2g/dia (EPA+DHA) — com almoço ou jantar\nMagnésio bisglícinato — 300mg — à noite antes de dormir'} />
          </div>
        </div>
      </div>

      {/* Orientações */}
      <div className="card">
        <div className="card-header"><div className="card-title">Orientações e Atenção</div></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Orientações gerais (1 por linha)</label>
            <textarea value={dados.orientacoes_gerais} onChange={e => set('orientacoes_gerais', e.target.value)} rows={7}
              placeholder={'Fixe horários como âncoras — não dependa de sentir fome para comer\nTome o magnésio todo dia à noite — sono melhor em 1 semana'} />
          </div>
          <div>
            <label className="field-label">Alimentos a reduzir (1 por linha)</label>
            <textarea value={dados.alimentos_reduzir} onChange={e => set('alimentos_reduzir', e.target.value)} rows={5}
              placeholder={'Açúcar refinado e mel em excesso — alimentam candidíase e pioram RI\nUltraprocessados doces'} />
          </div>
          <div>
            <label className="field-label">Observações personalizadas (aparece como card destacado)</label>
            <textarea value={dados.obs_personalizadas} onChange={e => set('obs_personalizadas', e.target.value)} rows={4}
              placeholder="Ex: A sexta não precisa ser perfeita — ela precisa ser consciente. Uma refeição livre não desfaz uma semana." />
          </div>
          <div>
            <label className="field-label">Atenção (1 por linha)</label>
            <textarea value={dados.atencao} onChange={e => set('atencao', e.target.value)} rows={7}
              placeholder={'Perceba os sinais de saciedade — comer devagar ajuda muito\nPese os alimentos pelo menos nas primeiras 2 semanas'} />
          </div>
        </div>
      </div>

      {/* Vegetais e encerramento */}
      <div className="card">
        <div className="card-header"><div className="card-title">Alimentos Liberados e Encerramento</div></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label">Vegetais/alimentos liberados à vontade (separados por vírgula)</label>
            <textarea value={dados.vegetais_liberados} onChange={e => set('vegetais_liberados', e.target.value)} rows={3} />
          </div>
          <div>
            <label className="field-label">Frase de encerramento</label>
            <input value={dados.frase_encerramento} onChange={e => set('frase_encerramento', e.target.value)}
              placeholder='"Quem você quer ser é inegociável."' />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PUBLICAR LISTA DE COMPRAS
   ============================================================ */
function PublicarLista({ pacienteId, nutriId }) {
  const [historico, setHistorico] = useState([]);
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [verJson, setVerJson] = useState(null);

  async function carregar() {
    const { data } = await supabase
      .from('listas_compras')
      .select('id, dados, publicado_em')
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

    const v = validarLista(dados);
    if (!v.ok) return setFeedback({ tipo: 'erro', msg: v.erro });

    setBusy(true);
    const { error } = await supabase.from('listas_compras').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
      dados,
    });
    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Lista publicada! A paciente verá agora.' });
    setJson('');
    carregar();
  }

  async function excluirLista(l) {
    const data = dataBR(l.publicado_em);
    if (!window.confirm(`Excluir lista de compras publicada em ${data}?\n\nA paciente não verá mais esta lista.`)) return;
    const { error } = await supabase.from('listas_compras').delete().eq('id', l.id);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Lista excluída.' });
    carregar();
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Publicar nova lista de compras</div>
            <div className="card-sub">Cole o JSON gerado pela sua Skill 7 (categorias + itens)</div>
          </div>
        </div>
        <div className="card-body">
          <label className="field-label">JSON da lista</label>
          <textarea
            value={json}
            onChange={e => setJson(e.target.value)}
            rows={10}
            placeholder='{"lista": [{"categoria": "Hortifruti", "itens": ["banana", "maçã"]}]}'
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />

          <DicaJSON
            exemploPrompt='gera um JSON de lista de compras pra paciente, agrupando os itens por categoria (Hortifruti, Proteínas, Grãos e cereais, Laticínios, Mercearia, Outros). Inclui só os nomes dos itens (sem quantidade). Estrutura: { "lista": [{ "categoria": "Hortifruti", "emoji": "🥦", "itens": ["banana", "maçã", "alface", "tomate"] }, ...] }' />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn" onClick={publicar} disabled={busy || !json.trim()}>
              <i className="ti ti-send" aria-hidden="true"></i> {busy ? 'Publicando...' : 'Publicar lista'}
            </button>
          </div>

          {feedback && <FeedbackInline f={feedback} />}
        </div>
      </div>

      <HistoricoLista
        titulo="Listas publicadas"
        items={historico}
        onDelete={excluirLista}
        renderItem={(l) => (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {contarItensLista(l.dados)} itens em {l.dados?.lista?.length ?? 0} categorias
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                Publicada em {dataBR(l.publicado_em)}
              </div>
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setVerJson(l)}>
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
  const [sexo, setSexo]         = useState('feminino');
  const [peso, setPeso]         = useState('');
  const [altura, setAltura]     = useState('');
  const [idade, setIdade]       = useState('');
  const [pgc, setPgc]           = useState('');
  const [mmKg, setMmKg]         = useState('');
  const [fator, setFator]       = useState('1.55');
  const [carregou, setCarregou] = useState(false);

  // Preenche com dados da avaliação mais recente + nascimento
  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('peso_registros')
        .select('kg, altura_cm, pgc, mm_kg')
        .eq('paciente_id', paciente.id)
        .order('data', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.kg)      setPeso(String(data.kg));
      if (data?.altura_cm) setAltura(String(data.altura_cm));
      if (data?.pgc)     setPgc(String(data.pgc));
      if (data?.mm_kg)   setMmKg(String(data.mm_kg));
      setCarregou(true);
    }

    // Calcula idade a partir do nascimento
    if (paciente.nascimento) {
      const n = new Date(paciente.nascimento + 'T12:00:00');
      const h = new Date();
      let a = h.getFullYear() - n.getFullYear();
      const m = h.getMonth() - n.getMonth();
      if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
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
  const g  = num(pgc);
  const mm = num(mmKg);
  const fa = parseFloat(fator);

  // Mifflin-St Jeor
  const tmb_mifflin = (p && al && id)
    ? (sexo === 'feminino'
        ? (10 * p) + (6.25 * al) - (5 * id) - 161
        : (10 * p) + (6.25 * al) - (5 * id) + 5)
    : null;

  // Harris-Benedict
  const tmb_harris = (p && al && id)
    ? (sexo === 'feminino'
        ? 655.1 + (9.563 * p) + (1.850 * al) - (4.676 * id)
        : 66.5  + (13.75 * p) + (5.003 * al) - (6.775 * id))
    : null;

  // Katch-McArdle — usa massa magra direta; se não tiver, calcula do % gordura
  const massaMagraEfetiva = mm ?? (p && g ? p * (1 - g / 100) : null);
  const tmb_katch = massaMagraEfetiva ? 370 + (21.6 * massaMagraEfetiva) : null;

  return (
    <>
      {/* Parâmetros */}
      <div className="card" style={{ padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Parâmetros</div>
          {carregou && (
            <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
              Preenchido com a avaliação mais recente
            </div>
          )}
        </div>

        {/* Sexo */}
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Sexo biológico</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[['feminino', 'Feminino'], ['masculino', 'Masculino']].map(([val, lbl]) => (
              <button key={val} onClick={() => setSexo(val)} style={{
                padding: '7px 20px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 13,
                border: `1.5px solid ${sexo === val ? 'var(--gold-deep)' : 'var(--border)'}`,
                background: sexo === val ? 'var(--amber-bg, var(--bg2))' : 'var(--white)',
                color: sexo === val ? 'var(--gold-deep)' : 'var(--text2)',
                fontWeight: sexo === val ? 600 : 400,
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Peso / Altura / Idade */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
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
        </div>

        {/* % Gordura / Massa magra — para Katch-McArdle */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label className="field-label">
              % Gordura corporal
              <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>
                (Katch-McArdle)
              </span>
            </label>
            <input inputMode="decimal" value={pgc}
              onChange={e => setPgc(e.target.value)} placeholder="ex: 28,5" />
          </div>
          <div>
            <label className="field-label">
              Massa magra (kg)
              <span style={{ color: 'var(--text3)', fontWeight: 400, marginLeft: 4 }}>
                (ou calcula do %)
              </span>
            </label>
            <input inputMode="decimal" value={mmKg}
              onChange={e => setMmKg(e.target.value)} placeholder="ex: 48,2" />
            {!mmKg && massaMagraEfetiva && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                Calculada: {massaMagraEfetiva.toFixed(1)} kg
              </div>
            )}
          </div>
        </div>

        {/* Fator de atividade */}
        <div>
          <label className="field-label">Fator de atividade</label>
          <select value={fator} onChange={e => setFator(e.target.value)}>
            {FATORES_ATIVIDADE.map(f => (
              <option key={f.v} value={f.v}>{f.l} ({f.v}×)</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultados — 3 fórmulas lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <ResultadoFormula
          nome="Mifflin-St Jeor"
          descricao="Padrão clínico atual"
          tmb={tmb_mifflin}
          tdee={tmb_mifflin ? tmb_mifflin * fa : null}
          aviso={!p || !al || !id ? 'Preencha peso, altura e idade' : null}
        />
        <ResultadoFormula
          nome="Harris-Benedict"
          descricao="Revisada (Roza & Shizgal)"
          tmb={tmb_harris}
          tdee={tmb_harris ? tmb_harris * fa : null}
          aviso={!p || !al || !id ? 'Preencha peso, altura e idade' : null}
        />
        <ResultadoFormula
          nome="Katch-McArdle"
          descricao="Baseada na massa magra"
          tmb={tmb_katch}
          tdee={tmb_katch ? tmb_katch * fa : null}
          aviso={!massaMagraEfetiva ? 'Preencha % gordura ou massa magra' : null}
        />
      </div>

      {/* Legenda fórmulas */}
      <div className="card" style={{ padding: 14, marginTop: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Fórmulas utilizadas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Mifflin · Mulher', '(10×P) + (6,25×A) − (5×I) − 161'],
            ['Mifflin · Homem',  '(10×P) + (6,25×A) − (5×I) + 5'],
            ['Harris · Mulher',  '655,1 + (9,563×P) + (1,850×A) − (4,676×I)'],
            ['Harris · Homem',   '66,5 + (13,75×P) + (5,003×A) − (6,775×I)'],
            ['Katch-McArdle',    '370 + (21,6 × Massa Magra)'],
            ['TDEE',             'TMB × Fator de atividade'],
          ].map(([label, formula]) => (
            <div key={label} style={{ fontSize: 11 }}>
              <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}: </span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text2)' }}>{formula}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          P = Peso (kg) · A = Altura (cm) · I = Idade (anos)
        </div>
      </div>
    </>
  );
}

function ResultadoFormula({ nome, descricao, tmb, tdee, aviso }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{nome}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{descricao}</div>
      </div>

      {aviso ? (
        <div style={{
          padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)',
          fontSize: 12, color: 'var(--text3)', fontStyle: 'italic',
        }}>{aviso}</div>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, fontWeight: 500 }}>
              TMB — Taxa metabólica basal
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--gold-deep)', lineHeight: 1 }}>
              {Math.round(tmb).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>kcal/dia</div>
          </div>
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3, fontWeight: 500 }}>
              TDEE — Gasto total diário
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--dark)', lineHeight: 1 }}>
              {Math.round(tdee).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>kcal/dia</div>
          </div>
        </>
      )}
    </div>
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
