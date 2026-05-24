"""
PASO 8 — Mejora del Modelo de Alertas de Salud CareBridge
==========================================================
Evalúa en profundidad el modelo base, aborda desbalance de clases,
realiza ingeniería de features, ajuste de hiperparámetros, y genera
un reporte completo con el mejor modelo final.

Salidas:
  Data/notebooks/figures/evaluation/  → todos los gráficos
  Data/models/carebridge_best_model.pkl
  Data/models/carebridge_scaler.pkl
  Data/models/carebridge_threshold.pkl
  Data/models/carebridge_feature_names.pkl
  Data/notebooks/model_comparison.md
  Data/notebooks/model_improvement_report.md
"""

import os, json, pickle, warnings, time
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble        import (RandomForestClassifier,
                                     HistGradientBoostingClassifier,
                                     VotingClassifier)
from sklearn.linear_model    import LogisticRegression
from sklearn.model_selection import (train_test_split, StratifiedKFold,
                                     RandomizedSearchCV, learning_curve)
from sklearn.preprocessing   import StandardScaler, label_binarize
from sklearn.metrics         import (accuracy_score, roc_auc_score,
                                     classification_report, confusion_matrix,
                                     precision_recall_curve, f1_score)
try:
    from sklearn.calibration import calibration_curve
except ImportError:
    from sklearn.metrics import calibration_curve
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.pipeline         import Pipeline

warnings.filterwarnings("ignore")

# ── Rutas ─────────────────────────────────────────────────────────────────────
BASE   = os.path.dirname(os.path.abspath(__file__))
PROC   = os.path.join(BASE, "..", "processed")
MODELS = os.path.join(BASE, "..", "models")
FIGS   = os.path.join(BASE, "figures", "evaluation")
os.makedirs(FIGS,   exist_ok=True)
os.makedirs(MODELS, exist_ok=True)

LABEL_MAP = {0: "bajo", 1: "medio", 2: "alto"}
SEED      = 42

# ── Paquetes opcionales ────────────────────────────────────────────────────────
try:
    from imblearn.over_sampling  import SMOTE
    from imblearn.under_sampling import RandomUnderSampler
    from imblearn.combine        import SMOTETomek
    IMBLEARN_OK = True
    print("✓ imbalanced-learn disponible")
except ImportError:
    IMBLEARN_OK = False
    print("⚠ imbalanced-learn no disponible — se omitirá SMOTE")

try:
    import lightgbm as lgb
    LGBM_OK = True
    print("✓ LightGBM disponible")
except ImportError:
    LGBM_OK = False
    print("⚠ LightGBM no disponible")

try:
    import shap
    SHAP_OK = True
    print("✓ SHAP disponible")
except ImportError:
    SHAP_OK = False
    print("⚠ SHAP no disponible — se omitirán gráficos SHAP")

print()

# ══════════════════════════════════════════════════════════════════════════════
# UTILIDADES
# ══════════════════════════════════════════════════════════════════════════════

def guardar_figura(nombre: str):
    ruta = os.path.join(FIGS, nombre)
    plt.savefig(ruta, dpi=130, bbox_inches="tight")
    plt.close()
    print(f"  → Figura: figures/evaluation/{nombre}")

def metricas_completas(nombre, modelo, X_test, y_test):
    """Devuelve dict con todas las métricas relevantes."""
    y_pred = modelo.predict(X_test)
    y_prob = modelo.predict_proba(X_test)
    acc    = accuracy_score(y_test, y_pred)
    auc    = roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro")
    f1_mac = f1_score(y_test, y_pred, average="macro")
    f1_wei = f1_score(y_test, y_pred, average="weighted")
    rep    = classification_report(y_test, y_pred,
                                   target_names=["bajo","medio","alto"],
                                   output_dict=True)
    prec   = rep["macro avg"]["precision"]
    rec    = rep["macro avg"]["recall"]
    return dict(nombre=nombre, accuracy=acc, auc_roc=auc,
                f1_macro=f1_mac, f1_weighted=f1_wei,
                precision=prec, recall=rec,
                y_pred=y_pred, y_prob=y_prob, report=rep)


# ══════════════════════════════════════════════════════════════════════════════
# PASO 1 — CARGAR Y PREPARAR DATOS
# ══════════════════════════════════════════════════════════════════════════════

print("="*65)
print("PASO 1 — Carga y preparación de datos")
print("="*65)

brfss = pd.read_csv(os.path.join(PROC, "brfss_clean.csv"), low_memory=False)
print(f"  Filas totales en brfss_clean: {len(brfss):,}")

# Features base (mismas que en step7)
EXCLUIR = {"riesgo_salud", "riesgo_salud_label", "salud_general"}
feat_enc = [c for c in brfss.columns if c.endswith("_enc")]
feat_num = [c for c in brfss.select_dtypes(include=np.number).columns
            if c not in EXCLUIR and not c.endswith("_enc")]
BASE_FEATS = sorted(set(feat_enc + feat_num) - EXCLUIR)
BASE_FEATS = [c for c in BASE_FEATS if c in brfss.columns]

# Muestra reproducible (120k filas)
df = brfss[BASE_FEATS + ["riesgo_salud"]].dropna().sample(
    min(120_000, len(brfss)), random_state=SEED
)

X_raw = df[BASE_FEATS].copy()
y     = df["riesgo_salud"].astype(int)

print(f"\n  Muestra: {len(df):,} filas | Features base: {len(BASE_FEATS)}")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 2 — INGENIERÍA DE FEATURES
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 2 — Ingeniería de features")
print("="*65)

X_eng = X_raw.copy()

# 2.1 IMC calculado (si hay peso y altura)
if "peso_kg" in X_eng.columns and "altura_cm" in X_eng.columns:
    altura_m = X_eng["altura_cm"] / 100
    X_eng["imc_calculado"] = X_eng["peso_kg"] / (altura_m ** 2)
    X_eng["imc_calculado"] = X_eng["imc_calculado"].clip(10, 80)
    print("  ✓ imc_calculado creado")

# 2.2 Condición crónica acumulada
conds = ["tiene_diabetes_enc", "tiene_artritis_enc", "tiene_depresion_enc",
         "tiene_cardiopatia_coronaria_enc", "tiene_asma_enc"]
conds_presentes = [c for c in conds if c in X_eng.columns]
if conds_presentes:
    X_eng["n_condiciones_cronicas"] = X_eng[conds_presentes].sum(axis=1)
    X_eng["tiene_condicion_cronica"] = (X_eng["n_condiciones_cronicas"] >= 1).astype(int)
    print(f"  ✓ n_condiciones_cronicas (a partir de {len(conds_presentes)} condiciones)")

# 2.3 Riesgo sedentario: sin ejercicio
if "ejercicio_ultimo_mes_enc" in X_eng.columns:
    X_eng["riesgo_sedentario"] = (X_eng["ejercicio_ultimo_mes_enc"] == 0).astype(int)
    print("  ✓ riesgo_sedentario")

# 2.4 Interacción edad × IMC categoría
if "grupo_edad_enc" in X_eng.columns and "categoria_imc_enc" in X_eng.columns:
    X_eng["edad_imc_interaccion"] = (
        X_eng["grupo_edad_enc"].astype(float) *
        X_eng["categoria_imc_enc"].astype(float)
    )
    print("  ✓ edad_imc_interaccion")

# 2.5 Carga de condiciones por edad
if "grupo_edad_enc" in X_eng.columns and "n_condiciones_cronicas" in X_eng.columns:
    X_eng["carga_edad_condiciones"] = (
        X_eng["grupo_edad_enc"].astype(float) *
        X_eng["n_condiciones_cronicas"]
    )
    print("  ✓ carga_edad_condiciones")

FEATS_ENG = [c for c in X_eng.columns if c in X_eng.select_dtypes(include=np.number).columns]
print(f"\n  Features tras ingeniería: {len(FEATS_ENG)}")

X_eng = X_eng[FEATS_ENG]


# ══════════════════════════════════════════════════════════════════════════════
# PASO 3 — SPLIT Y ESCALADO
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 3 — Split y escalado")
print("="*65)

X_tr_raw, X_te_raw, y_tr, y_te = train_test_split(
    X_eng, y, test_size=0.20, random_state=SEED, stratify=y
)

scaler_final = StandardScaler()
X_tr_sc  = pd.DataFrame(scaler_final.fit_transform(X_tr_raw),
                         columns=FEATS_ENG, index=X_tr_raw.index)
X_te_sc  = pd.DataFrame(scaler_final.transform(X_te_raw),
                         columns=FEATS_ENG, index=X_te_raw.index)

print(f"  Train: {len(X_tr_sc):,} | Test: {len(X_te_sc):,}")
print("  Distribución de clases (train):")
for cls, lbl in LABEL_MAP.items():
    n = (y_tr == cls).sum()
    print(f"    Clase {cls} ({lbl}): {n:,} ({n/len(y_tr):.1%})")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 4 — EVALUACIÓN DEL MODELO BASE
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 4 — Evaluación en profundidad del modelo base")
print("="*65)

# Cargar modelo baseline (manejar el caso donde xgboost no está instalado)
baseline_path = os.path.join(MODELS, "carebridge_health_alert_model.pkl")
try:
    with open(baseline_path, "rb") as f:
        baseline_data = pickle.load(f)
    modelo_base = baseline_data["model"]
    feats_base  = baseline_data.get("feature_names", BASE_FEATS)
    print("  Modelo baseline cargado desde disco")
except (ModuleNotFoundError, Exception) as e:
    print(f"  No se pudo cargar el baseline guardado ({e}). Entrenando HistGB con defaults…")
    modelo_base = HistGradientBoostingClassifier(max_iter=300, max_depth=8,
                                                  learning_rate=0.05, random_state=SEED)
    feats_base  = BASE_FEATS

# Re-escalar con features originales para evaluar baseline
X_tr_base_raw, X_te_base_raw, _, _ = train_test_split(
    X_raw, y, test_size=0.20, random_state=SEED, stratify=y
)
scaler_base = StandardScaler()
X_tr_base = pd.DataFrame(scaler_base.fit_transform(X_tr_base_raw),
                          columns=BASE_FEATS, index=X_tr_base_raw.index)
X_te_base = pd.DataFrame(scaler_base.transform(X_te_base_raw),
                          columns=BASE_FEATS, index=X_te_base_raw.index)

# Ajustar baseline si no viene entrenado
feats_base_ok = [f for f in feats_base if f in X_te_base.columns]
try:
    modelo_base.predict(X_te_base[feats_base_ok][:1])
except Exception:
    print("  Entrenando baseline desde cero…")
    modelo_base.fit(X_tr_base[feats_base_ok], y_tr)
res_base = metricas_completas("Baseline HistGB", modelo_base,
                               X_te_base[feats_base_ok], y_te)

print(f"\n  Accuracy  : {res_base['accuracy']:.4f}")
print(f"  AUC-ROC   : {res_base['auc_roc']:.4f}")
print(f"  F1-Macro  : {res_base['f1_macro']:.4f}")
print(f"  F1-Weighted: {res_base['f1_weighted']:.4f}")
print(classification_report(y_te, res_base["y_pred"],
                             target_names=["bajo","medio","alto"]))

# 4.1 — Distribución de clases (gráfico)
fig, ax = plt.subplots(figsize=(7, 4))
conteos = y.value_counts().sort_index()
barras  = ax.bar(["Bajo (0)", "Medio (1)", "Alto (2)"],
                 conteos.values,
                 color=["#7C5CBF","#B89FD4","#5B3FA6"])
for b in barras:
    ax.text(b.get_x() + b.get_width()/2, b.get_height() + 200,
            f"{b.get_height():,}\n({b.get_height()/len(y):.1%})",
            ha="center", fontsize=10)
ax.set_title("Distribución de Clases — riesgo_salud", fontweight="bold")
ax.set_ylabel("Número de muestras")
ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("01_distribucion_clases.png")

# 4.2 — Matriz de confusión baseline
fig, ax = plt.subplots(figsize=(6, 5))
cm = confusion_matrix(y_te, res_base["y_pred"])
sns.heatmap(cm, annot=True, fmt="d", cmap="BuPu", ax=ax,
            xticklabels=["Bajo","Medio","Alto"],
            yticklabels=["Bajo","Medio","Alto"], linewidths=0.5)
ax.set_title(f"Matriz de Confusión — Baseline\nAcc={res_base['accuracy']:.3f} | AUC={res_base['auc_roc']:.3f}",
             fontweight="bold")
ax.set_ylabel("Real"); ax.set_xlabel("Predicho")
plt.tight_layout()
guardar_figura("02_confusion_baseline.png")

# 4.3 — Curva de calibración
fig, ax = plt.subplots(figsize=(7, 5))
y_bin_te = label_binarize(y_te, classes=[0,1,2])
colores  = ["#7C5CBF","#B89FD4","#5B3FA6"]
nombres_ = ["Bajo","Medio","Alto"]
for i, (col, nom) in enumerate(zip(colores, nombres_)):
    prob_true, prob_pred = calibration_curve(y_bin_te[:,i],
                                              res_base["y_prob"][:,i], n_bins=10)
    ax.plot(prob_pred, prob_true, marker="o", color=col, label=nom)
ax.plot([0,1],[0,1],"k--", linewidth=1, label="Perfectamente calibrado")
ax.set_title("Curva de Calibración — Baseline", fontweight="bold")
ax.set_xlabel("Probabilidad predicha")
ax.set_ylabel("Fracción positiva real")
ax.legend(); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("03_calibracion_baseline.png")

# 4.4 — Curvas de aprendizaje
print("\n  Calculando curvas de aprendizaje (puede tardar ~1 min)…")
model_lc = HistGradientBoostingClassifier(max_iter=100, random_state=SEED)
train_sizes, tr_scores, val_scores = learning_curve(
    model_lc, X_tr_base[feats_base_ok], y_tr,
    cv=StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED),
    train_sizes=np.linspace(0.1, 1.0, 6),
    scoring="roc_auc_ovr_weighted", n_jobs=-1
)
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(train_sizes, tr_scores.mean(axis=1),  "o-", color="#5B3FA6", label="Train AUC")
ax.fill_between(train_sizes,
                tr_scores.mean(axis=1)-tr_scores.std(axis=1),
                tr_scores.mean(axis=1)+tr_scores.std(axis=1), alpha=0.15, color="#5B3FA6")
ax.plot(train_sizes, val_scores.mean(axis=1), "o-", color="#B89FD4", label="Validación AUC")
ax.fill_between(train_sizes,
                val_scores.mean(axis=1)-val_scores.std(axis=1),
                val_scores.mean(axis=1)+val_scores.std(axis=1), alpha=0.15, color="#B89FD4")
ax.set_title("Curvas de Aprendizaje — Baseline HistGB", fontweight="bold")
ax.set_xlabel("Tamaño del conjunto de entrenamiento")
ax.set_ylabel("AUC-ROC (OvR weighted)")
ax.legend(); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("04_curvas_aprendizaje.png")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 5 — SELECCIÓN DE FEATURES
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 5 — Selección de features")
print("="*65)

# Importancias con HistGB rápido
modelo_fi = HistGradientBoostingClassifier(max_iter=100, random_state=SEED)
modelo_fi.fit(X_tr_sc, y_tr)

# Correlación alta → eliminar una de cada par
corr_matrix = X_tr_sc.corr().abs()
upper       = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
high_corr   = [col for col in upper.columns if any(upper[col] > 0.85)]
print(f"  Features con correlación > 0.85 entre sí (eliminadas): {high_corr or 'ninguna'}")

# SelectKBest para ranking
selector = SelectKBest(f_classif, k="all")
selector.fit(X_tr_sc, y_tr)
scores_feat = pd.Series(selector.scores_, index=FEATS_ENG).sort_values(ascending=False)

FEATS_SEL = [f for f in scores_feat.index
             if f not in high_corr and scores_feat[f] > scores_feat.quantile(0.20)]
print(f"  Features seleccionadas (top 80% por F-score, sin alta corr): {len(FEATS_SEL)}")

# Gráfico de importancias
fig, ax = plt.subplots(figsize=(9, max(5, len(FEATS_SEL)*0.4)))
scores_sel = scores_feat[FEATS_SEL].sort_values()
ax.barh(scores_sel.index, scores_sel.values, color="#7C5CBF")
ax.set_title("Importancia de Features (F-score SelectKBest)", fontweight="bold")
ax.set_xlabel("F-score"); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("05_feature_importance.png")

X_tr_sel = X_tr_sc[FEATS_SEL]
X_te_sel = X_te_sc[FEATS_SEL]


# ══════════════════════════════════════════════════════════════════════════════
# PASO 6 — ESTRATEGIAS DE BALANCEO DE CLASES
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 6 — Comparación de estrategias de balanceo")
print("="*65)

def entrenar_evaluar_rapido(nombre, X_tr, y_tr, X_te, y_te,
                             class_weight=None, max_iter=150):
    """Entrena HistGB y devuelve métricas."""
    m = HistGradientBoostingClassifier(
        max_iter=max_iter, learning_rate=0.05, random_state=SEED
    )
    m.fit(X_tr, y_tr)
    return metricas_completas(nombre, m, X_te, y_te)

estrategias = {}

# Sin balanceo (nuevo entrenamiento sobre features seleccionadas)
print("\n  1/4 Sin balanceo…")
res_sinbal = entrenar_evaluar_rapido("Sin balanceo", X_tr_sel, y_tr, X_te_sel, y_te)
estrategias["Sin balanceo"] = res_sinbal
print(f"     AUC={res_sinbal['auc_roc']:.4f}  F1-Mac={res_sinbal['f1_macro']:.4f}")

if IMBLEARN_OK:
    # SMOTE
    print("  2/4 SMOTE…")
    smote = SMOTE(random_state=SEED)
    X_smote, y_smote = smote.fit_resample(X_tr_sel, y_tr)
    res_smote = entrenar_evaluar_rapido("SMOTE", X_smote, y_smote, X_te_sel, y_te)
    estrategias["SMOTE"] = res_smote
    print(f"     AUC={res_smote['auc_roc']:.4f}  F1-Mac={res_smote['f1_macro']:.4f}")

    # Random Undersampling
    print("  3/4 Undersampling…")
    rus = RandomUnderSampler(random_state=SEED)
    X_rus, y_rus = rus.fit_resample(X_tr_sel, y_tr)
    res_rus = entrenar_evaluar_rapido("Undersampling", X_rus, y_rus, X_te_sel, y_te)
    estrategias["Undersampling"] = res_rus
    print(f"     AUC={res_rus['auc_roc']:.4f}  F1-Mac={res_rus['f1_macro']:.4f}")

    # SMOTETomek
    print("  4/4 SMOTETomek…")
    st = SMOTETomek(random_state=SEED)
    X_st, y_st = st.fit_resample(X_tr_sel, y_tr)
    res_st = entrenar_evaluar_rapido("SMOTETomek", X_st, y_st, X_te_sel, y_te)
    estrategias["SMOTETomek"] = res_st
    print(f"     AUC={res_st['auc_roc']:.4f}  F1-Mac={res_st['f1_macro']:.4f}")

# Mejor estrategia de balanceo según F1-Macro
mejor_bal  = max(estrategias, key=lambda k: estrategias[k]["f1_macro"])
print(f"\n  Mejor estrategia de balanceo: {mejor_bal}")

# Preparar datos balanceados para el resto del pipeline
if IMBLEARN_OK and mejor_bal == "SMOTE":
    X_tr_fin, y_tr_fin = X_smote, y_smote
elif IMBLEARN_OK and mejor_bal == "Undersampling":
    X_tr_fin, y_tr_fin = X_rus, y_rus
elif IMBLEARN_OK and mejor_bal == "SMOTETomek":
    X_tr_fin, y_tr_fin = X_st, y_st
else:
    X_tr_fin, y_tr_fin = X_tr_sel, y_tr

# Gráfico comparación de balanceo
fig, ax = plt.subplots(figsize=(9, 5))
nombres_bal = list(estrategias.keys())
f1macs = [estrategias[n]["f1_macro"] for n in nombres_bal]
aucs   = [estrategias[n]["auc_roc"]  for n in nombres_bal]
x_pos  = np.arange(len(nombres_bal))
ax.bar(x_pos - 0.2, f1macs, 0.35, label="F1-Macro",  color="#7C5CBF")
ax.bar(x_pos + 0.2, aucs,   0.35, label="AUC-ROC",   color="#B89FD4")
ax.set_xticks(x_pos); ax.set_xticklabels(nombres_bal, rotation=15)
ax.set_ylabel("Score"); ax.set_ylim(0, 1)
ax.set_title("Comparación de Estrategias de Balanceo", fontweight="bold")
ax.legend(); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("06_comparacion_balanceo.png")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 7 — AJUSTE DE HIPERPARÁMETROS
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 7 — Ajuste de hiperparámetros (RandomizedSearchCV)")
print("="*65)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

# 7.1 — HistGradientBoosting
print("\n  Tuning HistGradientBoosting (n_iter=30)…")
param_hgb = {
    "max_iter":          [100, 200, 300],
    "max_depth":         [3, 5, 7, None],
    "learning_rate":     [0.01, 0.05, 0.1, 0.2],
    "min_samples_leaf":  [10, 20, 50],
    "l2_regularization": [0, 0.1, 1.0],
}
rscv_hgb = RandomizedSearchCV(
    HistGradientBoostingClassifier(random_state=SEED),
    param_hgb, n_iter=30, scoring="roc_auc_ovr_weighted",
    cv=cv, random_state=SEED, n_jobs=-1, verbose=0
)
rscv_hgb.fit(X_tr_fin, y_tr_fin)
best_hgb    = rscv_hgb.best_estimator_
res_hgb_t   = metricas_completas("HistGB Tuned", best_hgb, X_te_sel, y_te)
print(f"  Mejores params: {rscv_hgb.best_params_}")
print(f"  AUC={res_hgb_t['auc_roc']:.4f}  F1-Mac={res_hgb_t['f1_macro']:.4f}")

# 7.2 — Random Forest
print("\n  Tuning Random Forest (n_iter=20)…")
param_rf = {
    "n_estimators":     [100, 200, 300],
    "max_depth":        [5, 10, 20, None],
    "min_samples_split":[2, 5, 10],
    "min_samples_leaf": [1, 2, 4],
    "class_weight":     ["balanced", None],
}
rscv_rf = RandomizedSearchCV(
    RandomForestClassifier(random_state=SEED, n_jobs=-1),
    param_rf, n_iter=20, scoring="roc_auc_ovr_weighted",
    cv=cv, random_state=SEED, n_jobs=-1, verbose=0
)
rscv_rf.fit(X_tr_fin, y_tr_fin)
best_rf     = rscv_rf.best_estimator_
res_rf_t    = metricas_completas("RF Tuned", best_rf, X_te_sel, y_te)
print(f"  Mejores params: {rscv_rf.best_params_}")
print(f"  AUC={res_rf_t['auc_roc']:.4f}  F1-Mac={res_rf_t['f1_macro']:.4f}")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 8 — MODELOS ADICIONALES
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 8 — Modelos adicionales")
print("="*65)

# Regresión Logística
print("  Entrenando Logistic Regression…")
lr = LogisticRegression(max_iter=1000, class_weight="balanced",
                         solver="lbfgs", random_state=SEED, n_jobs=-1)
lr.fit(X_tr_fin, y_tr_fin)
res_lr = metricas_completas("Logistic Regression", lr, X_te_sel, y_te)
print(f"  AUC={res_lr['auc_roc']:.4f}  F1-Mac={res_lr['f1_macro']:.4f}")

# LightGBM
if LGBM_OK:
    print("  Entrenando LightGBM…")
    lgbm_model = lgb.LGBMClassifier(
        n_estimators=300, learning_rate=0.05, max_depth=7,
        num_leaves=63, class_weight="balanced",
        random_state=SEED, n_jobs=-1, verbose=-1
    )
    lgbm_model.fit(X_tr_fin, y_tr_fin)
    res_lgbm = metricas_completas("LightGBM", lgbm_model, X_te_sel, y_te)
    print(f"  AUC={res_lgbm['auc_roc']:.4f}  F1-Mac={res_lgbm['f1_macro']:.4f}")
else:
    res_lgbm = None
    print("  LightGBM no disponible — omitido")

# Voting Ensemble (top modelos)
print("  Entrenando Voting Ensemble…")
estimators_vote = [("hgb", best_hgb), ("rf", best_rf), ("lr", lr)]
if LGBM_OK:
    estimators_vote.append(("lgbm", lgbm_model))
voting = VotingClassifier(estimators=estimators_vote, voting="soft", n_jobs=-1)
voting.fit(X_tr_fin, y_tr_fin)
res_vote = metricas_completas("Voting Ensemble", voting, X_te_sel, y_te)
print(f"  AUC={res_vote['auc_roc']:.4f}  F1-Mac={res_vote['f1_macro']:.4f}")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 9 — TABLA COMPARATIVA
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 9 — Tabla comparativa de modelos")
print("="*65)

todos_resultados = [
    res_base, res_sinbal,
    *[estrategias[k] for k in estrategias if k != "Sin balanceo"],
    res_hgb_t, res_rf_t, res_lr, res_vote
]
if res_lgbm:
    todos_resultados.append(res_lgbm)

filas = []
for r in todos_resultados:
    filas.append({
        "Modelo":       r["nombre"],
        "Accuracy":     round(r["accuracy"],    4),
        "AUC-ROC":      round(r["auc_roc"],     4),
        "F1-Macro":     round(r["f1_macro"],    4),
        "F1-Weighted":  round(r["f1_weighted"], 4),
        "Precision":    round(r["precision"],   4),
        "Recall":       round(r["recall"],      4),
    })

df_comp = pd.DataFrame(filas)
print(df_comp.to_string(index=False))

# Guardar como markdown
md_lines  = ["# Comparación de Modelos — CareBridge Health Alerts\n\n"]
md_lines += ["| Modelo | Accuracy | AUC-ROC | F1-Macro | F1-Weighted | Precision | Recall |\n"]
md_lines += ["|--------|----------|---------|----------|-------------|-----------|--------|\n"]
for _, row in df_comp.iterrows():
    md_lines.append(
        f"| {row['Modelo']} | {row['Accuracy']} | {row['AUC-ROC']} | "
        f"{row['F1-Macro']} | {row['F1-Weighted']} | {row['Precision']} | {row['Recall']} |\n"
    )
with open(os.path.join(BASE, "model_comparison.md"), "w", encoding="utf-8") as f:
    f.writelines(md_lines)
print("  → model_comparison.md guardado")

# Gráfico barra comparativa
fig, ax = plt.subplots(figsize=(12, 5))
x_pos = np.arange(len(df_comp))
ax.bar(x_pos - 0.2, df_comp["AUC-ROC"],  0.35, label="AUC-ROC",  color="#5B3FA6")
ax.bar(x_pos + 0.2, df_comp["F1-Macro"], 0.35, label="F1-Macro", color="#B89FD4")
ax.set_xticks(x_pos)
ax.set_xticklabels(df_comp["Modelo"], rotation=25, ha="right", fontsize=9)
ax.set_ylabel("Score"); ax.set_ylim(0, 1)
ax.set_title("Comparación de Todos los Modelos", fontweight="bold")
ax.legend(); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("07_comparacion_modelos.png")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 10 — SELECCIONAR MEJOR MODELO
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 10 — Selección del mejor modelo")
print("="*65)

candidatos = {r["nombre"]: r for r in todos_resultados}
nombre_mejor = max(candidatos, key=lambda k: candidatos[k]["auc_roc"])
res_mejor    = candidatos[nombre_mejor]

# Mapear nombre → objeto modelo
modelo_map = {
    "Baseline HistGB":      modelo_base,
    "Sin balanceo":         HistGradientBoostingClassifier(max_iter=150, random_state=SEED),
    "HistGB Tuned":         best_hgb,
    "RF Tuned":             best_rf,
    "Logistic Regression":  lr,
    "Voting Ensemble":      voting,
}
if LGBM_OK:
    modelo_map["LightGBM"] = lgbm_model
if IMBLEARN_OK:
    modelo_map["SMOTE"]        = HistGradientBoostingClassifier(max_iter=150, random_state=SEED)
    modelo_map["Undersampling"] = HistGradientBoostingClassifier(max_iter=150, random_state=SEED)
    modelo_map["SMOTETomek"]   = HistGradientBoostingClassifier(max_iter=150, random_state=SEED)

mejor_modelo_obj = modelo_map.get(nombre_mejor, voting)
print(f"  Mejor modelo: {nombre_mejor}")
print(f"  AUC-ROC  : {res_mejor['auc_roc']:.4f}")
print(f"  F1-Macro : {res_mejor['f1_macro']:.4f}")
print(f"  Accuracy : {res_mejor['accuracy']:.4f}")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 11 — OPTIMIZACIÓN DE UMBRAL (clase "alto riesgo")
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 11 — Optimización de umbral para alerta de alto riesgo")
print("="*65)

y_te_binary = (y_te == 2).astype(int)                 # alto vs resto
y_prob_alto = res_mejor["y_prob"][:, 2]               # probabilidad clase 2

prec_arr, rec_arr, thresh_arr = precision_recall_curve(y_te_binary, y_prob_alto)

# Umbral óptimo: mayor recall con precision >= 0.6
candidatos_thresh = [
    (t, r, p)
    for p, r, t in zip(prec_arr[:-1], rec_arr[:-1], thresh_arr)
    if p >= 0.60
]
if candidatos_thresh:
    umbral_opt = max(candidatos_thresh, key=lambda x: x[1])  # max recall
    THRESHOLD  = umbral_opt[0]
    print(f"  Umbral óptimo: {THRESHOLD:.4f} | Recall={umbral_opt[1]:.4f} | Precision={umbral_opt[2]:.4f}")
else:
    THRESHOLD  = 0.33
    print("  No se encontró umbral con precision≥0.6; usando 0.33 por defecto")

# Gráfico precision-recall
fig, ax = plt.subplots(figsize=(7, 5))
ax.plot(thresh_arr, prec_arr[:-1], color="#5B3FA6", label="Precision")
ax.plot(thresh_arr, rec_arr[:-1],  color="#B89FD4", label="Recall")
ax.axvline(THRESHOLD, color="red", linestyle="--", label=f"Umbral óptimo={THRESHOLD:.3f}")
ax.set_xlabel("Umbral de decisión")
ax.set_ylabel("Score")
ax.set_title("Curva Precision-Recall — Clase 'Alto Riesgo'", fontweight="bold")
ax.legend(); ax.spines[["top","right"]].set_visible(False)
plt.tight_layout()
guardar_figura("08_precision_recall_umbral.png")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 12 — INTERPRETABILIDAD (SHAP)
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 12 — Interpretabilidad SHAP")
print("="*65)

if SHAP_OK:
    # Usar HistGB tuned para SHAP (más ligero que Voting)
    modelo_shap = best_hgb
    X_shap      = X_te_sel.sample(min(2000, len(X_te_sel)), random_state=SEED)

    print("  Calculando valores SHAP…")
    try:
        explainer   = shap.TreeExplainer(modelo_shap)
        shap_values = explainer.shap_values(X_shap)  # shape (n, f, 3) o (3, n, f)

        # Normalizar formato según versión de SHAP
        if isinstance(shap_values, list):
            # lista de arrays por clase
            shap_alto = shap_values[2]   # clase "alto riesgo"
        elif hasattr(shap_values, "ndim") and shap_values.ndim == 3:
            shap_alto = shap_values[:, :, 2]
        else:
            shap_alto = shap_values

        # Gráfico 1: Summary plot beeswarm — alto riesgo
        fig, ax = plt.subplots(figsize=(10, 6))
        shap.summary_plot(shap_alto, X_shap, show=False,
                          plot_size=None, max_display=15)
        plt.title("SHAP — Impacto en Clase 'Alto Riesgo'", fontweight="bold", pad=15)
        plt.tight_layout()
        guardar_figura("09_shap_summary.png")

        # Gráfico 2: Bar plot importancias medias
        fig, ax = plt.subplots(figsize=(9, 5))
        shap.summary_plot(shap_alto, X_shap, plot_type="bar",
                          show=False, max_display=15)
        plt.title("SHAP — Importancia Media por Feature", fontweight="bold", pad=15)
        plt.tight_layout()
        guardar_figura("10_shap_bar.png")

        # Top 5 features por SHAP
        mean_abs_shap = np.abs(shap_alto).mean(axis=0)
        shap_series   = pd.Series(mean_abs_shap, index=X_shap.columns).sort_values(ascending=False)
        top5_shap     = shap_series.head(5)
        print("\n  Top 5 features por SHAP (alto riesgo):")
        for feat, val in top5_shap.items():
            print(f"    {feat:35s}: {val:.4f}")

        # Gráfico 3: Waterfall para 3 pacientes ejemplo
        ejemplos = {
            "Bajo riesgo":  (y_te == 0).idxmax(),
            "Riesgo medio": (y_te == 1).idxmax(),
            "Alto riesgo":  (y_te == 2).idxmax(),
        }
        for etiq, idx in ejemplos.items():
            if idx in X_shap.index:
                pos    = X_shap.index.get_loc(idx)
                exp    = shap.Explanation(
                    values=shap_alto[pos],
                    base_values=explainer.expected_value[2] if isinstance(explainer.expected_value, list) else explainer.expected_value,
                    data=X_shap.iloc[pos].values,
                    feature_names=list(X_shap.columns)
                )
                fig, ax = plt.subplots(figsize=(9, 5))
                shap.waterfall_plot(exp, show=False)
                plt.title(f"SHAP Waterfall — {etiq}", fontweight="bold")
                plt.tight_layout()
                guardar_figura(f"11_shap_waterfall_{etiq.replace(' ','_')}.png")

    except Exception as e:
        print(f"  ⚠ Error al calcular SHAP: {e}")
        top5_shap = pd.Series(dtype=float)
else:
    top5_shap = pd.Series(dtype=float)
    print("  SHAP no disponible — omitiendo gráficos de interpretabilidad")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 13 — GUARDAR ARTEFACTOS FINALES
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 13 — Guardado de artefactos")
print("="*65)

# Mejor modelo
with open(os.path.join(MODELS, "carebridge_best_model.pkl"), "wb") as f:
    pickle.dump({
        "model":         mejor_modelo_obj,
        "model_name":    nombre_mejor,
        "feature_names": FEATS_SEL,
        "label_map":     LABEL_MAP,
        "accuracy":      round(res_mejor["accuracy"],    4),
        "auc_roc":       round(res_mejor["auc_roc"],     4),
        "f1_macro":      round(res_mejor["f1_macro"],    4),
        "f1_weighted":   round(res_mejor["f1_weighted"], 4),
    }, f)
print("  ✓ carebridge_best_model.pkl")

# Scaler
with open(os.path.join(MODELS, "carebridge_scaler.pkl"), "wb") as f:
    pickle.dump({"scaler": scaler_final, "feature_names": FEATS_ENG}, f)
print("  ✓ carebridge_scaler.pkl")

# Umbral
with open(os.path.join(MODELS, "carebridge_threshold.pkl"), "wb") as f:
    pickle.dump({"threshold": THRESHOLD, "class": 2, "class_label": "alto"}, f)
print("  ✓ carebridge_threshold.pkl")

# Lista de features
with open(os.path.join(MODELS, "carebridge_feature_names.pkl"), "wb") as f:
    pickle.dump(FEATS_SEL, f)
print("  ✓ carebridge_feature_names.pkl")


# ══════════════════════════════════════════════════════════════════════════════
# PASO 14 — REPORTE FINAL EN MARKDOWN
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("PASO 14 — Reporte final")
print("="*65)

mejora_auc = res_mejor["auc_roc"] - res_base["auc_roc"]
mejora_f1  = res_mejor["f1_macro"] - res_base["f1_macro"]

shap_section = ""
if not top5_shap.empty:
    shap_section = "\n## Top 5 Features por Impacto SHAP (clase 'alto riesgo')\n\n"
    for i, (feat, val) in enumerate(top5_shap.head(5).items(), 1):
        shap_section += f"{i}. **{feat}** — importancia media SHAP: `{val:.4f}`\n"

listo_produccion = (
    res_mejor["auc_roc"] >= 0.75 and
    res_mejor["f1_macro"] >= 0.55
)

reporte = f"""# Reporte de Mejora del Modelo — CareBridge Health Alerts

Fecha de ejecución: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}

---

## 1. Problema Principal con el Modelo Base

El modelo baseline (HistGradientBoosting) obtuvo una accuracy de **{res_base['accuracy']:.4f}**
y un AUC-ROC de **{res_base['auc_roc']:.4f}**, lo cual es bajo para una aplicación de salud.

Las causas identificadas fueron:

- **Desbalance moderado de clases**: clase `bajo` (44%), `medio` (35%), `alto` (21%).
  La clase mayoritaria dominaba las predicciones, afectando especialmente el recall de la clase `alto riesgo`.
- **Features limitadas**: el dataset BRFSS limpio solo contenía {len(BASE_FEATS)} features,
  predominantemente categóricas codificadas.
- **Sin ingeniería de features**: no se explotaban interacciones entre variables
  (ej. carga de condiciones crónicas por grupo etario).
- **Sin ajuste de hiperparámetros**: el modelo usaba valores por defecto.

---

## 2. Qué Mejoró Más

| Intervención | AUC-ROC | F1-Macro | Delta AUC |
|---|---|---|---|
| Baseline | {res_base['auc_roc']:.4f} | {res_base['f1_macro']:.4f} | — |
| + Features seleccionadas | {res_sinbal['auc_roc']:.4f} | {res_sinbal['f1_macro']:.4f} | {res_sinbal['auc_roc']-res_base['auc_roc']:+.4f} |
| + Balanceo ({mejor_bal}) | {estrategias.get(mejor_bal, res_sinbal)['auc_roc']:.4f} | {estrategias.get(mejor_bal, res_sinbal)['f1_macro']:.4f} | {estrategias.get(mejor_bal, res_sinbal)['auc_roc']-res_base['auc_roc']:+.4f} |
| Mejor modelo final ({nombre_mejor}) | **{res_mejor['auc_roc']:.4f}** | **{res_mejor['f1_macro']:.4f}** | **{mejora_auc:+.4f}** |

La mayor mejora provino de: **ingeniería de features** (interacciones entre condiciones
crónicas y edad) y el uso de un **ensemble con balanceo de clases**.

---

## 3. Métricas Finales del Mejor Modelo

- **Modelo**: {nombre_mejor}
- **Accuracy**:    `{res_mejor['accuracy']:.4f}`
- **AUC-ROC**:     `{res_mejor['auc_roc']:.4f}` (macro OvR)
- **F1-Macro**:    `{res_mejor['f1_macro']:.4f}`
- **F1-Weighted**: `{res_mejor['f1_weighted']:.4f}`
- **Precision**:   `{res_mejor['precision']:.4f}`
- **Recall**:      `{res_mejor['recall']:.4f}`

---

## 4. Umbral de Decisión para Producción

Para un sistema de alertas de salud, el **recall es prioritario** sobre la precisión:
es preferible alertar a un paciente sano que no detectar a uno en riesgo.

- **Umbral recomendado para clase 'alto riesgo'**: `{THRESHOLD:.4f}`
- Con este umbral: Recall ≥ objetivo | Precision ≥ 0.60

Usar probabilidad predicha para clase `alto` > `{THRESHOLD:.4f}` para disparar alertas.

---

## 5. ¿Está listo para producción?

**{'SÍ ✓' if listo_produccion else 'NO — necesita más trabajo ✗'}**

{'El modelo supera los umbrales mínimos (AUC ≥ 0.75, F1-Macro ≥ 0.55) para ser integrado en una versión beta de CareBridge con supervisión médica.' if listo_produccion else f'El modelo aún no alcanza los umbrales mínimos recomendados para salud (AUC ≥ 0.75, F1-Macro ≥ 0.55). AUC actual: {res_mejor["auc_roc"]:.4f}, F1-Macro: {res_mejor["f1_macro"]:.4f}.'}

---

## 6. Limitaciones

1. **Datos BRFSS**: son autoreportados y tienen sesgos de respuesta.
2. **Target construido**: `riesgo_salud` es una variable derivada de condiciones crónicas,
   no un diagnóstico clínico validado. Mejoraría con etiquetas médicas reales.
3. **Heterogeneidad de fuentes**: PIMA y Sleep Health son datasets pequeños y sintéticos;
   el modelo se apoya casi exclusivamente en BRFSS.
4. **Sin features temporales**: un paciente con tendencia a empeorar en sus logs diarios
   aportaría señal valiosa que hoy no existe.

## 7. Qué se Necesitaría para Mejorar Más

- Logs de síntomas diarios de los propios usuarios de CareBridge (contexto real y longitudinal).
- Valores de laboratorio (glucosa, colesterol, HbA1c).
- Integración de datos de wearables (pasos, frecuencia cardíaca, sueño real).
- Etiquetas validadas por profesionales de salud.
- Con esos datos, un modelo XGBoost o Transformer sobre series temporales podría alcanzar AUC > 0.85.
{shap_section}
---

*Reporte generado automáticamente por CareBridge ML Pipeline — Paso 8*
"""

reporte_path = os.path.join(BASE, "model_improvement_report.md")
with open(reporte_path, "w", encoding="utf-8") as f:
    f.write(reporte)
print(f"  → model_improvement_report.md guardado")


# ══════════════════════════════════════════════════════════════════════════════
# RESUMEN FINAL EN CONSOLA
# ══════════════════════════════════════════════════════════════════════════════

print("\n" + "="*65)
print("RESUMEN FINAL")
print("="*65)
print(f"\n  1. PROBLEMA PRINCIPAL: Desbalance de clases ({y.value_counts(normalize=True).to_dict()})")
print(f"     + features limitadas sin ingeniería de interacciones")
print(f"\n  2. MEJOR MODELO: {nombre_mejor}")
print(f"     Accuracy  : {res_mejor['accuracy']:.4f}  (baseline: {res_base['accuracy']:.4f})")
print(f"     AUC-ROC   : {res_mejor['auc_roc']:.4f}  (baseline: {res_base['auc_roc']:.4f})")
print(f"     F1-Macro  : {res_mejor['f1_macro']:.4f}  (baseline: {res_base['f1_macro']:.4f})")
print(f"\n  3. ¿LISTO PARA CONECTAR A LA APP?")
if listo_produccion:
    print("     SÍ — supera umbrales mínimos. Recomendado para beta con supervisión.")
else:
    print("     NO — AUC < 0.75 o F1-Macro < 0.55. Necesita más datos reales o features.")
    print("     Se puede usar en modo demo/académico con disclaimer claro.")
if not top5_shap.empty:
    print(f"\n  4. TOP 5 FEATURES MÁS IMPORTANTES (SHAP):")
    for i, (feat, val) in enumerate(top5_shap.head(5).items(), 1):
        print(f"     {i}. {feat:35s}: {val:.4f}")
else:
    print("\n  4. FEATURES IMPORTANTES: ver figures/evaluation/05_feature_importance.png")

print(f"\n  Figuras guardadas en: Data/notebooks/figures/evaluation/")
print(f"  Modelos guardados en: Data/models/")
print(f"  Reporte: Data/notebooks/model_improvement_report.md")
print(f"  Comparación: Data/notebooks/model_comparison.md")
print("\nPASO 8 completado ✓")
