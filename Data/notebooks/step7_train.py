"""
PASO 7 — Entrenamiento del Modelo de Alertas de Salud
=======================================================
Target: riesgo_salud → 0 (bajo) | 1 (medio) | 2 (alto)
Modelos: Random Forest + XGBoost
Métricas: Accuracy, AUC-ROC (OvR), Classification Report
Guarda el mejor modelo en models/carebridge_health_alert_model.pkl
Guarda el scaler en models/scaler.pkl
"""

import os, json, pickle, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble        import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing   import StandardScaler, LabelEncoder
from sklearn.metrics         import (accuracy_score, roc_auc_score,
                                     classification_report, confusion_matrix)
# XGBoost requiere libomp en macOS; usar HistGradientBoosting como fallback
try:
    from xgboost import XGBClassifier as _XGB
    _XGBOOST_AVAILABLE = True
except Exception:
    _XGBOOST_AVAILABLE = False

from sklearn.ensemble import HistGradientBoostingClassifier

warnings.filterwarnings("ignore")

BASE    = os.path.dirname(os.path.abspath(__file__))
PROC    = os.path.join(BASE, "..", "processed")
MODELS  = os.path.join(BASE, "..", "models")
SCRIPTS = os.path.join(BASE, "..", "scripts")
FIGURES = os.path.join(BASE, "figures")
os.makedirs(MODELS, exist_ok=True)

LABEL_MAP = {0: "bajo", 1: "medio", 2: "alto"}


def preparar_datos(brfss: pd.DataFrame):
    """Selecciona features y divide en train/test."""
    if "riesgo_salud" not in brfss.columns:
        raise ValueError("'riesgo_salud' no encontrado en BRFSS limpio.")

    # Features: solo numéricas y codificadas (excluyendo target y etiquetas)
    excluir = {"riesgo_salud", "riesgo_salud_label", "salud_general"}
    feat_enc = [c for c in brfss.columns if c.endswith("_enc")]
    feat_num = [c for c in brfss.select_dtypes(include=np.number).columns
                if c not in excluir and not c.endswith("_enc")]
    all_feats = sorted(set(feat_enc + feat_num) - excluir)
    all_feats = [c for c in all_feats if c in brfss.columns]

    sub = brfss[all_feats + ["riesgo_salud"]].dropna().sample(
        min(120_000, len(brfss)), random_state=42
    )

    X = sub[all_feats]
    y = sub["riesgo_salud"].astype(int)

    # Escalar features numéricas
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"  Train: {len(X_train):,} filas | Test: {len(X_test):,} filas")
    print(f"  Features: {len(all_feats)}")
    for cls, lbl in LABEL_MAP.items():
        n = (y == cls).sum()
        print(f"    Clase {cls} ({lbl}): {n:,} ({n/len(y):.1%})")

    return X_train, X_test, y_train, y_test, scaler, all_feats


def evaluar_modelo(nombre: str, modelo, X_test, y_test, X_train, y_train):
    """Evalúa un modelo entrenado y devuelve métricas."""
    y_pred = modelo.predict(X_test)
    y_prob = modelo.predict_proba(X_test)

    acc    = accuracy_score(y_test, y_pred)
    auc    = roc_auc_score(y_test, y_prob, multi_class="ovr", average="macro")
    report = classification_report(y_test, y_pred,
                                   target_names=["bajo", "medio", "alto"],
                                   output_dict=True)

    print(f"\n  ── {nombre} ──────────────────────────────────────")
    print(f"  Accuracy  : {acc:.4f}")
    print(f"  AUC-ROC   : {auc:.4f} (macro-OvR)")
    print(f"  {classification_report(y_test, y_pred, target_names=['bajo','medio','alto'])}")

    return {"nombre": nombre, "accuracy": acc, "auc_roc": auc,
            "report": report, "y_pred": y_pred, "y_prob": y_prob}


def plot_confusion_matrix(resultados: list, y_test, figuras_dir: str):
    """Matriz de confusión para ambos modelos."""
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, res in zip(axes, resultados):
        cm = confusion_matrix(y_test, res["y_pred"])
        sns.heatmap(cm, annot=True, fmt="d", cmap="BuPu", ax=ax,
                    xticklabels=["Bajo", "Medio", "Alto"],
                    yticklabels=["Bajo", "Medio", "Alto"],
                    linewidths=0.5)
        ax.set_title(f"Matriz de Confusión — {res['nombre']}\n"
                     f"Acc={res['accuracy']:.3f} | AUC={res['auc_roc']:.3f}",
                     fontsize=11, fontweight="bold")
        ax.set_ylabel("Real")
        ax.set_xlabel("Predicho")
    plt.tight_layout()
    out = os.path.join(figuras_dir, "confusion_matrices.png")
    plt.savefig(out, dpi=130, bbox_inches="tight")
    plt.close()
    print(f"  Figura guardada → figures/confusion_matrices.png")


def plot_roc_curves(resultados: list, y_test, figuras_dir: str):
    """Curvas ROC (OvR) para ambos modelos."""
    from sklearn.preprocessing import label_binarize
    from sklearn.metrics import roc_curve, auc

    y_bin    = label_binarize(y_test, classes=[0, 1, 2])
    colores  = [["#7C5CBF", "#9B7DBF", "#B89FD4"],
                ["#5B3FA6", "#7C5CBF", "#9B7DBF"]]
    nombres  = ["Bajo Riesgo", "Riesgo Medio", "Alto Riesgo"]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, res, cols in zip(axes, resultados, colores):
        for i, (nombre_cls, col) in enumerate(zip(nombres, cols)):
            fpr, tpr, _ = roc_curve(y_bin[:, i], res["y_prob"][:, i])
            auc_val     = auc(fpr, tpr)
            ax.plot(fpr, tpr, color=col, linewidth=2,
                    label=f"{nombre_cls} (AUC={auc_val:.3f})")
        ax.plot([0, 1], [0, 1], "k--", linewidth=1, alpha=0.5)
        ax.set_title(f"Curvas ROC — {res['nombre']}", fontsize=11, fontweight="bold")
        ax.set_xlabel("Tasa Falsos Positivos")
        ax.set_ylabel("Tasa Verdaderos Positivos")
        ax.legend(fontsize=9)
        ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    out = os.path.join(figuras_dir, "roc_curves.png")
    plt.savefig(out, dpi=130, bbox_inches="tight")
    plt.close()
    print(f"  Figura guardada → figures/roc_curves.png")


def guardar_metricas(resultados: list, features: list):
    """Guarda las métricas del modelo en JSON."""
    metricas = {}
    for res in resultados:
        metricas[res["nombre"]] = {
            "accuracy": round(res["accuracy"], 4),
            "auc_roc":  round(res["auc_roc"],  4),
            "report":   res["report"],
        }
    metricas["features_usadas"] = features

    out = os.path.join(SCRIPTS, "model_metrics.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(metricas, f, ensure_ascii=False, indent=2)
    print(f"  Métricas guardadas → {out}")
    return metricas


# ════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "="*60)
    print("PASO 7 — Entrenamiento de Modelos")
    print("="*60)

    brfss = pd.read_csv(os.path.join(PROC, "brfss_clean.csv"), low_memory=False)

    # ── Preparar datos ──────────────────────────────────────
    X_train, X_test, y_train, y_test, scaler, features = preparar_datos(brfss)

    # ── Guardar scaler ───────────────────────────────────────
    scaler_path = os.path.join(MODELS, "scaler.pkl")
    with open(scaler_path, "wb") as f:
        pickle.dump({"scaler": scaler, "feature_names": features}, f)
    print(f"\n  Scaler guardado → {scaler_path}")

    # ── Guardar lista de features ────────────────────────────
    with open(os.path.join(SCRIPTS, "features_list.json"), "w") as f:
        json.dump(features, f, indent=2)

    # ── Modelo 1: Random Forest ──────────────────────────────
    print("\n  Entrenando Random Forest…")
    rf = RandomForestClassifier(
        n_estimators=300, max_depth=15, min_samples_leaf=5,
        class_weight="balanced", random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    res_rf = evaluar_modelo("Random Forest", rf, X_test, y_test, X_train, y_train)

    # ── Modelo 2: XGBoost (o HistGradientBoosting si libomp no disponible) ──
    if _XGBOOST_AVAILABLE:
        print("\n  Entrenando XGBoost…")
        xgb = _XGB(n_estimators=300, max_depth=8, learning_rate=0.05,
                   subsample=0.8, colsample_bytree=0.8,
                   use_label_encoder=False, eval_metric="mlogloss",
                   random_state=42, n_jobs=-1, verbosity=0)
        xgb.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        nombre_xgb = "XGBoost"
    else:
        print("\n  XGBoost no disponible (falta libomp). Usando HistGradientBoostingClassifier…")
        xgb = HistGradientBoostingClassifier(
            max_iter=300, max_depth=8, learning_rate=0.05,
            random_state=42,
        )
        xgb.fit(X_train, y_train)
        nombre_xgb = "HistGradientBoosting (XGBoost fallback)"
    res_xgb = evaluar_modelo(nombre_xgb, xgb, X_test, y_test, X_train, y_train)

    # ── Seleccionar mejor modelo ─────────────────────────────
    resultados = [res_rf, res_xgb]
    mejor      = max(resultados, key=lambda r: r["auc_roc"])
    mejor_mod  = rf if mejor["nombre"] == "Random Forest" else xgb

    print(f"\n  MEJOR MODELO: {mejor['nombre']} "
          f"(AUC={mejor['auc_roc']:.4f}, Acc={mejor['accuracy']:.4f})")

    # ── Guardar mejor modelo ─────────────────────────────────
    modelo_path = os.path.join(MODELS, "carebridge_health_alert_model.pkl")
    with open(modelo_path, "wb") as f:
        pickle.dump({
            "model":         mejor_mod,
            "model_name":    mejor["nombre"],
            "feature_names": features,
            "label_map":     LABEL_MAP,
            "accuracy":      mejor["accuracy"],
            "auc_roc":       mejor["auc_roc"],
        }, f)
    print(f"  Modelo guardado → {modelo_path}")

    # ── Gráficas ─────────────────────────────────────────────
    plot_confusion_matrix(resultados, y_test, FIGURES)
    plot_roc_curves(resultados, y_test, FIGURES)

    # ── Guardar métricas ─────────────────────────────────────
    guardar_metricas(resultados, features)

    print("\nPASO 7 completado ✓")
