/* @ds-bundle: {"format":4,"namespace":"BicosDesignSystem_dedf03","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"CandidateRow","sourcePath":"components/marketplace/CandidateRow.jsx"},{"name":"JobCard","sourcePath":"components/marketplace/JobCard.jsx"},{"name":"Rating","sourcePath":"components/marketplace/Rating.jsx"},{"name":"AppBar","sourcePath":"components/navigation/AppBar.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"e6bff60f3959","components/core/Button.jsx":"472f15598567","components/core/Card.jsx":"406d34c954e4","components/core/Icon.jsx":"5c8e0872bf4a","components/core/IconButton.jsx":"9cc7caa53031","components/core/Tag.jsx":"da7d7d78c980","components/feedback/Dialog.jsx":"8b16bcd89baf","components/feedback/EmptyState.jsx":"0928cb579644","components/feedback/Skeleton.jsx":"5ab23670a9ae","components/feedback/Toast.jsx":"2ef6c855ca7c","components/feedback/Tooltip.jsx":"5f940d7c2f4a","components/forms/Checkbox.jsx":"96a4f33b4ddf","components/forms/Input.jsx":"8d14edd8a245","components/forms/Radio.jsx":"d16e252d539a","components/forms/Select.jsx":"17ed1a8ff66f","components/forms/Switch.jsx":"5a1dcb21d7c8","components/marketplace/CandidateRow.jsx":"aae1c912b47f","components/marketplace/JobCard.jsx":"dad425cf3e75","components/marketplace/Rating.jsx":"9f2c229c5e83","components/navigation/AppBar.jsx":"61cfe1b353ca","components/navigation/BottomNav.jsx":"02010cfac6d2","components/navigation/Tabs.jsx":"99ca8238d5dd","ui_kits/app_construtora/AvaliarPedreiro.jsx":"529fbe5fd88c","ui_kits/app_construtora/Candidatos.jsx":"a03b1f4b3a4e","ui_kits/app_construtora/PainelVagas.jsx":"ef562d6e4e03","ui_kits/app_construtora/PerfilConstrutora.jsx":"c8e248f06b28","ui_kits/app_construtora/PublicarVaga.jsx":"958a8c757dcb","ui_kits/app_pedreiro/DetalheVaga.jsx":"f535f2136430","ui_kits/app_pedreiro/Entrada.jsx":"292293826b04","ui_kits/app_pedreiro/MinhasCandidaturas.jsx":"59d809d16743","ui_kits/app_pedreiro/MuralVagas.jsx":"49d0ac5fb0e2","ui_kits/app_pedreiro/PerfilPedreiro.jsx":"b0b9c7bd7d5c","ui_kits/app_pedreiro/SelecaoPerfil.jsx":"4397c1ddf6b5"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BicosDesignSystem_dedf03 = window.BicosDesignSystem_dedf03 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  default: {
    background: 'var(--surface-card)',
    borderColor: 'var(--border)'
  },
  brand: {
    background: 'var(--surface-brand-subtle)',
    borderColor: 'var(--brand-border)'
  },
  sunken: {
    background: 'var(--surface-sunken)',
    borderColor: 'var(--border)'
  },
  warning: {
    background: 'var(--surface-warning)',
    borderColor: 'var(--amber-100)'
  },
  danger: {
    background: 'var(--surface-danger)',
    borderColor: 'var(--red-100)'
  }
};
function Card({
  children,
  tone = 'default',
  padding = 'var(--space-5)',
  interactive = false,
  elevated = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const clickable = interactive || Boolean(onClick);
  return /*#__PURE__*/React.createElement("div", _extends({
    role: clickable ? 'button' : undefined,
    tabIndex: clickable ? 0 : undefined,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      padding,
      border: '1px solid',
      borderColor: clickable && hover ? 'var(--border-strong)' : (TONES[tone] || TONES.default).borderColor,
      borderRadius: 'var(--radius-card)',
      boxShadow: elevated ? 'var(--shadow-2)' : 'var(--shadow-1)',
      cursor: clickable ? 'pointer' : 'default',
      transition: 'var(--transition-control)',
      ...(TONES[tone] || TONES.default),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = 'https://unpkg.com/lucide-static/icons/';

/* Lucide (CDN, mask-based) is the Bicos icon set. Colour follows currentColor,
   so an Icon inside a Button inherits the button's text colour automatically. */
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  label,
  style,
  ...rest
}) {
  const url = 'url("' + CDN + name + '.svg")';
  const base = {
    display: 'inline-block',
    flex: '0 0 auto',
    width: size,
    height: size,
    backgroundColor: color,
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    role: label ? 'img' : undefined,
    "aria-label": label || undefined,
    "aria-hidden": label ? undefined : 'true',
    style: {
      ...base,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  neutral: {
    fg: 'var(--gray-600)',
    bg: 'var(--gray-100)',
    bd: 'var(--gray-200)',
    solid: 'var(--gray-700)'
  },
  brand: {
    fg: 'var(--status-hired-fg)',
    bg: 'var(--status-hired-bg)',
    bd: 'var(--status-hired-border)',
    solid: 'var(--brand)'
  },
  accent: {
    fg: 'var(--teal-600)',
    bg: 'var(--teal-50)',
    bd: 'var(--teal-100)',
    solid: 'var(--accent)'
  },
  success: {
    fg: 'var(--status-open-fg)',
    bg: 'var(--status-open-bg)',
    bd: 'var(--status-open-border)',
    solid: 'var(--green-500)'
  },
  warning: {
    fg: 'var(--status-pending-fg)',
    bg: 'var(--status-pending-bg)',
    bd: 'var(--status-pending-border)',
    solid: 'var(--amber-500)'
  },
  danger: {
    fg: 'var(--status-refused-fg)',
    bg: 'var(--status-refused-bg)',
    bd: 'var(--status-refused-border)',
    solid: 'var(--red-500)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  variant = 'subtle',
  size = 'md',
  icon,
  dot = false,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  const solid = variant === 'solid';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      height: size === 'sm' ? 20 : 24,
      padding: size === 'sm' ? '0 var(--space-3)' : '0 var(--space-4)',
      borderRadius: 'var(--radius-pill)',
      font: size === 'sm' ? 'var(--type-meta)' : 'var(--weight-bold) var(--size-12)/1 var(--font-body)',
      letterSpacing: 'var(--tracking-wide)',
      whiteSpace: 'nowrap',
      background: solid ? t.solid : t.bg,
      color: solid ? 'var(--gray-0)' : t.fg,
      border: '1px solid ' + (solid ? 'transparent' : t.bd),
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 'var(--radius-pill)',
      background: solid ? 'var(--gray-0)' : t.fg
    }
  }) : null, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 'var(--touch-min)',
    padding: '0 var(--space-4)',
    font: 'var(--weight-bold) var(--size-14)/1 var(--font-body)',
    icon: 16
  },
  md: {
    height: 'var(--touch)',
    padding: '0 var(--space-6)',
    font: 'var(--type-button)',
    icon: 20
  },
  lg: {
    height: 'var(--touch-lg)',
    padding: '0 var(--space-7)',
    font: 'var(--weight-bold) var(--size-18)/1 var(--font-body)',
    icon: 22
  }
};
function tone(variant, state) {
  const map = {
    primary: {
      rest: {
        background: 'var(--brand)',
        color: 'var(--brand-on)',
        borderColor: 'var(--brand)'
      },
      hover: {
        background: 'var(--brand-hover)',
        borderColor: 'var(--brand-hover)'
      },
      active: {
        background: 'var(--brand-press)',
        borderColor: 'var(--brand-press)'
      }
    },
    secondary: {
      rest: {
        background: 'var(--surface-card)',
        color: 'var(--text-brand)',
        borderColor: 'var(--border-strong)'
      },
      hover: {
        background: 'var(--brand-subtle)',
        borderColor: 'var(--brand)'
      },
      active: {
        background: 'var(--blue-100)',
        borderColor: 'var(--brand-press)'
      }
    },
    ghost: {
      rest: {
        background: 'transparent',
        color: 'var(--text-brand)',
        borderColor: 'transparent'
      },
      hover: {
        background: 'var(--brand-subtle)'
      },
      active: {
        background: 'var(--blue-100)'
      }
    },
    danger: {
      rest: {
        background: 'var(--red-500)',
        color: 'var(--gray-0)',
        borderColor: 'var(--red-500)'
      },
      hover: {
        background: 'var(--red-600)',
        borderColor: 'var(--red-600)'
      },
      active: {
        background: 'var(--red-600)',
        borderColor: 'var(--red-600)'
      }
    },
    accent: {
      rest: {
        background: 'var(--accent)',
        color: 'var(--gray-0)',
        borderColor: 'var(--accent)'
      },
      hover: {
        background: 'var(--accent-hover)',
        borderColor: 'var(--accent-hover)'
      },
      active: {
        background: 'var(--teal-700)',
        borderColor: 'var(--teal-700)'
      }
    }
  };
  const v = map[variant] || map.primary;
  return {
    ...v.rest,
    ...(state === 'hover' ? v.hover : null),
    ...(state === 'active' ? v.active : null)
  };
}
function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  type = 'button',
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const off = disabled || loading;
  const state = off ? 'rest' : press ? 'active' : hover ? 'hover' : 'rest';
  const css = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-3)',
    width: fullWidth ? '100%' : 'auto',
    minHeight: s.height,
    height: s.height,
    padding: s.padding,
    font: s.font,
    letterSpacing: 'var(--tracking-normal)',
    border: '1px solid',
    borderRadius: 'var(--radius-control)',
    cursor: off ? 'not-allowed' : 'pointer',
    transition: 'var(--transition-control), transform var(--dur-instant) var(--ease-standard)',
    transform: !off && press ? 'scale(var(--press-scale))' : 'none',
    WebkitTapHighlightColor: 'transparent',
    ...tone(variant, state),
    ...(off ? {
      background: variant === 'ghost' || variant === 'secondary' ? 'var(--surface-card)' : 'var(--surface-disabled)',
      color: 'var(--text-subtle)',
      borderColor: 'var(--border)'
    } : null),
    ...style
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    "aria-busy": loading || undefined,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    onTouchStart: () => setPress(true),
    onTouchEnd: () => setPress(false),
    style: css
  }, rest), loading ? /*#__PURE__*/React.createElement(Spinner, {
    size: s.icon
  }) : iconLeft ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: s.icon
  }) : null, children, !loading && iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.icon
  }) : null);
}
function Spinner({
  size
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-pill)',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      animation: 'bicos-spin 700ms linear infinite'
    }
  });
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: 40,
  md: 48,
  lg: 56
};
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const px = SIZES[size] || SIZES.md;
  const skins = {
    ghost: {
      background: hover ? 'var(--gray-100)' : 'transparent',
      color: 'var(--text-body)',
      borderColor: 'transparent'
    },
    outline: {
      background: hover ? 'var(--brand-subtle)' : 'var(--surface-card)',
      color: 'var(--text-brand)',
      borderColor: hover ? 'var(--brand)' : 'var(--border-strong)'
    },
    solid: {
      background: hover ? 'var(--brand-hover)' : 'var(--brand)',
      color: 'var(--brand-on)',
      borderColor: 'transparent'
    },
    inverse: {
      background: hover ? 'rgba(255,255,255,0.16)' : 'transparent',
      color: 'var(--text-inverse)',
      borderColor: 'transparent'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: px,
      height: px,
      padding: 0,
      border: '1px solid',
      borderRadius: 'var(--radius-control)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'var(--transition-control), transform var(--dur-instant) var(--ease-standard)',
      transform: press && !disabled ? 'scale(var(--press-scale))' : 'none',
      opacity: disabled ? 0.45 : 1,
      WebkitTapHighlightColor: 'transparent',
      ...(skins[variant] || skins.ghost),
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 18 : 22
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tag({
  children,
  icon,
  onRemove,
  selected = false,
  onClick,
  style,
  ...rest
}) {
  const interactive = Boolean(onClick);
  const [hover, setHover] = React.useState(false);
  const El = interactive ? 'button' : 'span';
  return /*#__PURE__*/React.createElement(El, _extends({
    type: interactive ? 'button' : undefined,
    onClick: onClick,
    "aria-pressed": interactive ? selected : undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      minHeight: 36,
      padding: '0 var(--space-4)',
      border: '1px solid ' + (selected ? 'var(--brand)' : hover && interactive ? 'var(--border-strong)' : 'var(--border)'),
      borderRadius: 'var(--radius-pill)',
      background: selected ? 'var(--brand-subtle)' : 'var(--surface-card)',
      color: selected ? 'var(--text-brand)' : 'var(--text-body)',
      font: 'var(--type-label)',
      cursor: interactive ? 'pointer' : 'default',
      transition: 'var(--transition-control)',
      WebkitTapHighlightColor: 'transparent',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, children, onRemove ? /*#__PURE__*/React.createElement("span", {
    role: "button",
    "aria-label": "Remover",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    },
    style: {
      display: 'inline-flex',
      marginLeft: 'var(--space-1)',
      cursor: 'pointer',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 14
  })) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/* Mobile: bottom sheet. >=560px: centred modal. */
function Dialog({
  open = true,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancelar',
  onCancel,
  tone = 'brand',
  sheet = true,
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: sheet ? 'flex-end' : 'center',
      justifyContent: 'center',
      background: 'var(--scrim)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: sheet ? 'none' : 420,
      padding: 'var(--space-6)',
      background: 'var(--surface-card)',
      borderRadius: sheet ? 'var(--radius-sheet) var(--radius-sheet) 0 0' : 'var(--radius-sheet)',
      boxShadow: 'var(--shadow-sheet)',
      animation: 'bicos-slide-up var(--dur-normal) var(--ease-out)',
      ...style
    }
  }, sheet ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 4,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gray-200)',
      margin: '0 auto var(--space-5)'
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      marginBottom: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-2)',
      background: tone === 'danger' ? 'var(--surface-danger)' : 'var(--surface-brand-subtle)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: tone === 'danger' ? 'triangle-alert' : 'circle-help',
    size: 22,
    color: tone === 'danger' ? 'var(--text-danger)' : 'var(--text-brand)'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-heading)',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)',
      marginTop: 'var(--space-2)'
    }
  }, description) : null)), children, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-6)'
    }
  }, confirmLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: tone === 'danger' ? 'danger' : 'primary',
    size: "lg",
    fullWidth: true,
    onClick: onConfirm
  }, confirmLabel) : null, cancelLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "md",
    fullWidth: true,
    onClick: onCancel
  }, cancelLabel) : null)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon = 'search-x',
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
  style
}) {
  const tint = tone === 'danger' ? {
    bg: 'var(--surface-danger)',
    fg: 'var(--text-danger)'
  } : tone === 'offline' ? {
    bg: 'var(--surface-warning)',
    fg: 'var(--text-warning)'
  } : {
    bg: 'var(--gray-100)',
    fg: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-9) var(--space-5)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 64,
      height: 64,
      borderRadius: 'var(--radius-pill)',
      background: tint.bg
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 30,
    color: tint.fg
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-heading)',
      color: 'var(--text-strong)',
      margin: 0
    }
  }, title), description ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)',
      maxWidth: 320
    }
  }, description) : null, actionLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    onClick: onAction,
    style: {
      marginTop: 'var(--space-2)'
    }
  }, actionLabel) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-1)',
  lines = 1,
  gap = 'var(--space-3)',
  style
}) {
  const bar = (w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'block',
      width: w,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-shine) 37%, var(--skeleton-base) 63%)',
      backgroundSize: '400% 100%',
      animation: 'bicos-shine 1.4s var(--ease-standard) infinite'
    }
  });
  if (lines === 1) return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      ...style
    }
  }, bar(width, 0));
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap,
      ...style
    }
  }, Array.from({
    length: lines
  }, (_, i) => bar(i === lines - 1 ? '60%' : width, i)));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const TONES = {
  success: {
    icon: 'circle-check',
    bg: 'var(--green-500)'
  },
  danger: {
    icon: 'circle-alert',
    bg: 'var(--red-500)'
  },
  info: {
    icon: 'info',
    bg: 'var(--gray-800)'
  },
  offline: {
    icon: 'wifi-off',
    bg: 'var(--amber-500)'
  }
};
function Toast({
  children,
  tone = 'success',
  action,
  onAction,
  onClose,
  style
}) {
  const t = TONES[tone] || TONES.info;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      minHeight: 'var(--touch)',
      padding: 'var(--space-3) var(--space-4)',
      background: t.bg,
      color: 'var(--text-inverse)',
      borderRadius: 'var(--radius-2)',
      boxShadow: 'var(--shadow-3)',
      font: 'var(--type-small)',
      animation: 'bicos-slide-up var(--dur-normal) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, children), action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-inverse)',
      font: 'var(--type-label)',
      textDecoration: 'underline',
      cursor: 'pointer',
      padding: 'var(--space-2)'
    }
  }, action) : null, onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Fechar",
    onClick: onClose,
    style: {
      background: 'transparent',
      border: 'none',
      color: 'var(--text-inverse)',
      cursor: 'pointer',
      display: 'inline-flex',
      padding: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  })) : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children,
  placement = 'top',
  style
}) {
  const [show, setShow] = React.useState(false);
  const pos = placement === 'bottom' ? {
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)'
  } : {
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false)
  }, children, show ? /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      zIndex: 40,
      whiteSpace: 'nowrap',
      padding: 'var(--space-2) var(--space-3)',
      background: 'var(--surface-inverse)',
      color: 'var(--text-inverse)',
      font: 'var(--type-meta)',
      borderRadius: 'var(--radius-1)',
      boxShadow: 'var(--shadow-2)',
      pointerEvents: 'none',
      ...pos,
      ...style
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  error = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      minHeight: 'var(--touch-min)',
      padding: 'var(--space-2) 0',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      flex: '0 0 auto',
      marginTop: 2,
      borderRadius: 'var(--radius-1)',
      border: '2px solid ' + (error ? 'var(--border-danger)' : checked ? 'var(--brand)' : 'var(--border-strong)'),
      background: checked ? 'var(--brand)' : 'var(--surface-card)',
      transition: 'var(--transition-control)'
    }
  }, checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 16,
    color: "var(--gray-0)"
  }) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-strong)'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, description) : null));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  type = 'text',
  iconLeft,
  suffix,
  disabled = false,
  required = false,
  id,
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const uid = React.useMemo(() => id || 'in-' + Math.random().toString(36).slice(2, 8), [id]);
  const border = error ? 'var(--border-danger)' : focus ? 'var(--border-focus)' : 'var(--border-strong)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: uid,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-strong)'
    }
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-danger)'
    }
  }, " *") : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      minHeight: 'var(--touch)',
      padding: '0 var(--space-4)',
      background: disabled ? 'var(--surface-disabled)' : 'var(--surface-card)',
      border: '1px solid ' + border,
      borderRadius: 'var(--radius-control)',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'var(--transition-control)'
    }
  }, iconLeft ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: 20,
    color: "var(--text-subtle)"
  }) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: uid,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    required: required,
    "aria-invalid": error ? 'true' : undefined,
    "aria-describedby": error || hint ? uid + '-msg' : undefined,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: 'var(--touch)',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'var(--type-body)',
      color: 'var(--text-strong)',
      ...inputStyle
    }
  }, rest)), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, suffix) : null), error || hint ? /*#__PURE__*/React.createElement("span", {
    id: uid + '-msg',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      font: 'var(--type-small)',
      color: error ? 'var(--text-danger)' : 'var(--text-muted)'
    }
  }, error ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "circle-alert",
    size: 14
  }) : null, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Radio({
  label,
  description,
  icon,
  checked = false,
  onChange,
  name,
  value,
  disabled = false,
  card = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      minHeight: card ? 'var(--touch-lg)' : 'var(--touch-min)',
      padding: card ? 'var(--space-5)' : 'var(--space-2) 0',
      border: card ? '1px solid ' + (checked ? 'var(--brand)' : 'var(--border)') : 'none',
      borderRadius: card ? 'var(--radius-card)' : 0,
      background: card ? checked ? 'var(--brand-subtle)' : 'var(--surface-card)' : 'transparent',
      boxShadow: card ? 'var(--shadow-1)' : 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'var(--transition-control)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-2)',
      background: checked ? 'var(--brand)' : 'var(--gray-100)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 24,
    color: checked ? 'var(--gray-0)' : 'var(--text-muted)'
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, description) : null), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-pill)',
      border: '2px solid ' + (checked ? 'var(--brand)' : 'var(--border-strong)'),
      background: 'var(--surface-card)'
    }
  }, checked ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--brand)'
    }
  }) : null));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  hint,
  error,
  value,
  onChange,
  options = [],
  placeholder = 'Selecione',
  disabled = false,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const uid = React.useMemo(() => id || 'sel-' + Math.random().toString(36).slice(2, 8), [id]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: uid,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-strong)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      background: disabled ? 'var(--surface-disabled)' : 'var(--surface-card)',
      border: '1px solid ' + (error ? 'var(--border-danger)' : focus ? 'var(--border-focus)' : 'var(--border-strong)'),
      borderRadius: 'var(--radius-control)',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: uid,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      width: '100%',
      height: 'var(--touch)',
      padding: '0 var(--space-9) 0 var(--space-4)',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      font: 'var(--type-body)',
      color: value ? 'var(--text-strong)' : 'var(--text-subtle)',
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, rest), placeholder ? /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder) : null, options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 20,
    color: "var(--text-muted)",
    style: {
      position: 'absolute',
      right: 'var(--space-4)',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none'
    }
  })), error || hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: error ? 'var(--text-danger)' : 'var(--text-muted)'
    }
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Switch({
  label,
  description,
  checked = false,
  onChange,
  disabled = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-5)',
      minHeight: 'var(--touch)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-strong)'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, description) : null), /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      flex: '0 0 auto',
      width: 52,
      height: 32,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--brand)' : 'var(--gray-300)',
      transition: 'background-color var(--dur-fast) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 4,
      left: checked ? 24 : 4,
      width: 24,
      height: 24,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gray-0)',
      boxShadow: 'var(--shadow-1)',
      transition: 'left var(--dur-fast) var(--ease-standard)'
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/marketplace/JobCard.jsx
try { (() => {
const STATUS = {
  aberta: {
    tone: 'success',
    label: 'Aberta'
  },
  aguardando: {
    tone: 'warning',
    label: 'Aguardando resposta'
  },
  contratado: {
    tone: 'brand',
    label: 'Você foi contratado'
  },
  recusada: {
    tone: 'danger',
    label: 'Não foi essa vez'
  },
  encerrada: {
    tone: 'neutral',
    label: 'Encerrada'
  }
};
function Meta({
  icon,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    color: "var(--text-subtle)"
  }), children);
}
function JobCard({
  role,
  company,
  pay,
  payUnit = 'diária',
  location,
  distance,
  date,
  status,
  urgent = false,
  applicants,
  onClick,
  style
}) {
  const st = STATUS[status];
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    onClick: onClick,
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginBottom: 'var(--space-1)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-heading)',
      color: 'var(--text-strong)',
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, role), urgent ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "danger",
    size: "sm",
    icon: "zap"
  }, "Hoje") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-body)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, company)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-numeric)',
      color: 'var(--money-fg)'
    }
  }, pay), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, payUnit))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3) var(--space-5)'
    }
  }, location ? /*#__PURE__*/React.createElement(Meta, {
    icon: "map-pin"
  }, location, distance ? ' · ' + distance : '') : null, date ? /*#__PURE__*/React.createElement(Meta, {
    icon: "calendar"
  }, date) : null, applicants != null ? /*#__PURE__*/React.createElement(Meta, {
    icon: "users"
  }, applicants, " ", applicants === 1 ? 'candidato' : 'candidatos') : null), st ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      paddingTop: 'var(--space-4)',
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: st.tone,
    dot: true
  }, st.label), onClick ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 20,
    color: "var(--text-subtle)"
  }) : null) : null);
}
Object.assign(__ds_scope, { JobCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketplace/JobCard.jsx", error: String((e && e.message) || e) }); }

// components/marketplace/Rating.jsx
try { (() => {
function Rating({
  value = 0,
  count,
  size = 16,
  editable = false,
  onChange,
  showValue = true,
  style
}) {
  const stars = [1, 2, 3, 4, 5];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 2
    }
  }, stars.map(s => {
    const on = s <= Math.round(value);
    const star = /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "star",
      size: editable ? 32 : size,
      color: on ? 'var(--amber-500)' : 'var(--gray-300)'
    });
    return editable ? /*#__PURE__*/React.createElement("button", {
      key: s,
      type: "button",
      "aria-label": s + ' de 5',
      onClick: () => onChange && onChange(s),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'var(--touch)',
        height: 'var(--touch)',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer'
      }
    }, star) : /*#__PURE__*/React.createElement("span", {
      key: s,
      style: {
        display: 'inline-flex'
      }
    }, star);
  })), showValue && !editable ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--weight-bold) var(--size-14)/1 var(--font-body)',
      color: 'var(--text-strong)'
    }
  }, value.toFixed(1).replace('.', ',')) : null, count != null && !editable ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "(", count, ")") : null);
}
Object.assign(__ds_scope, { Rating });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketplace/Rating.jsx", error: String((e && e.message) || e) }); }

// components/marketplace/CandidateRow.jsx
try { (() => {
function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function CandidateRow({
  name,
  role,
  rating,
  jobsDone,
  distance,
  isNew = false,
  status,
  onApprove,
  onRefuse,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-4)',
      padding: 'var(--space-5)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border)',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 48,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent-subtle)',
      color: 'var(--teal-700)',
      font: 'var(--weight-bold) var(--size-16)/1 var(--font-body)'
    }
  }, initials(name)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, name), isNew ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "accent",
    size: "sm"
  }, "Novo na plataforma") : null, status ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: status === 'aprovado' ? 'success' : status === 'recusado' ? 'danger' : 'warning',
    size: "sm",
    dot: true
  }, status === 'aprovado' ? 'Aprovado' : status === 'recusado' ? 'Recusado' : 'Aguardando') : null), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, role), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      flexWrap: 'wrap'
    }
  }, isNew ? null : /*#__PURE__*/React.createElement(__ds_scope.Rating, {
    value: rating || 0,
    count: jobsDone,
    size: 14
  }), distance ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 14,
    color: "var(--text-subtle)"
  }), distance) : null), onApprove || onRefuse ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-2)'
    }
  }, onApprove ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    iconLeft: "check",
    onClick: e => {
      e.stopPropagation();
      onApprove();
    }
  }, "Aprovar") : null, onRefuse ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "secondary",
    onClick: e => {
      e.stopPropagation();
      onRefuse();
    }
  }, "Recusar") : null) : null));
}
Object.assign(__ds_scope, { CandidateRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketplace/CandidateRow.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppBar.jsx
try { (() => {
function AppBar({
  title,
  subtitle,
  onBack,
  actions,
  tone = 'brand',
  style
}) {
  const brand = tone === 'brand';
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      minHeight: 'var(--appbar-h)',
      padding: '0 var(--space-3)',
      background: brand ? 'var(--surface-brand)' : 'var(--surface-card)',
      color: brand ? 'var(--text-inverse)' : 'var(--text-strong)',
      borderBottom: brand ? 'none' : '1px solid var(--border)',
      ...style
    }
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "arrow-left",
    label: "Voltar",
    variant: brand ? 'inverse' : 'ghost',
    size: "sm",
    onClick: onBack
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      padding: onBack ? 0 : '0 var(--space-2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-heading)',
      fontFamily: 'var(--font-display)',
      letterSpacing: 'var(--tracking-display)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      opacity: brand ? 0.85 : 1,
      color: brand ? 'inherit' : 'var(--text-muted)'
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-1)'
    }
  }, (actions || []).map(a => /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    key: a.label,
    icon: a.icon,
    label: a.label,
    onClick: a.onClick,
    variant: brand ? 'inverse' : 'ghost',
    size: "sm"
  }))));
}
Object.assign(__ds_scope, { AppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
function BottomNav({
  items = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + Math.max(items.length, 1) + ', 1fr)',
      minHeight: 'var(--bottomnav-h)',
      paddingBottom: 'var(--safe-bottom)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-bar)',
      ...style
    }
  }, items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      type: "button",
      onClick: () => onChange && onChange(it.id),
      "aria-current": active ? 'page' : undefined,
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-1)',
        minHeight: 'var(--bottomnav-h)',
        padding: 'var(--space-2)',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        color: active ? 'var(--text-brand)' : 'var(--text-muted)',
        WebkitTapHighlightColor: 'transparent'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 24
    }), it.badge ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--red-500)',
        color: 'var(--gray-0)',
        font: 'var(--weight-bold) 11px/18px var(--font-body)',
        textAlign: 'center'
      }
    }, it.badge) : null), /*#__PURE__*/React.createElement("span", {
      style: {
        font: active ? 'var(--weight-bold) var(--size-12)/1.2 var(--font-body)' : 'var(--type-meta)'
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'underline',
  style
}) {
  const seg = variant === 'segmented';
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'flex',
      gap: seg ? 'var(--space-1)' : 'var(--space-5)',
      padding: seg ? 'var(--space-1)' : 0,
      background: seg ? 'var(--surface-sunken)' : 'transparent',
      borderRadius: seg ? 'var(--radius-2)' : 0,
      borderBottom: seg ? 'none' : '1px solid var(--border)',
      overflowX: 'auto',
      ...style
    }
  }, items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      role: "tab",
      type: "button",
      "aria-selected": active,
      onClick: () => onChange && onChange(it.id),
      style: {
        flex: seg ? 1 : '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        minHeight: seg ? 40 : 'var(--touch)',
        padding: seg ? '0 var(--space-4)' : '0 var(--space-1)',
        border: 'none',
        background: seg ? active ? 'var(--surface-card)' : 'transparent' : 'transparent',
        borderRadius: seg ? 'var(--radius-1)' : 0,
        boxShadow: seg && active ? 'var(--shadow-1)' : 'none',
        borderBottom: seg ? 'none' : '3px solid ' + (active ? 'var(--brand)' : 'transparent'),
        marginBottom: seg ? 0 : -1,
        color: active ? 'var(--text-brand)' : 'var(--text-muted)',
        font: active ? 'var(--type-body-strong)' : 'var(--type-body)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'var(--transition-control)',
        WebkitTapHighlightColor: 'transparent'
      }
    }, it.label, it.count != null ? /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 20,
        padding: '0 6px',
        borderRadius: 'var(--radius-pill)',
        background: active ? 'var(--brand-subtle)' : 'var(--gray-100)',
        color: active ? 'var(--text-brand)' : 'var(--text-muted)',
        font: 'var(--type-meta)'
      }
    }, it.count) : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_construtora/AvaliarPedreiro.jsx
try { (() => {
function AvaliarPedreiro({
  go
}) {
  const {
    AppBar,
    Button,
    Card,
    Rating,
    Tag,
    Input,
    Toast,
    Icon
  } = window.BicosDesignSystem_dedf03;
  const [nota, setNota] = React.useState(0);
  const [tags, setTags] = React.useState([]);
  const [ok, setOk] = React.useState(false);
  const opcoes = ['Chegou no horário', 'Serviço bem feito', 'Cuidou do material', 'Bom de equipe'];
  function alterna(t) {
    setTags(tags.indexOf(t) >= 0 ? tags.filter(function (x) {
      return x !== t;
    }) : tags.concat([t]));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    tone: "plain",
    title: "Avaliar di\xE1ria",
    onBack: function () {
      go('painel');
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 48,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent-subtle)',
      color: 'var(--teal-700)',
      font: 'var(--weight-bold) var(--size-16)/1 var(--font-body)'
    }
  }, "JC"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, "Jos\xE9 Carlos Silva"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "Pedreiro de acabamento \xB7 8 set")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-numeric)',
      color: 'var(--money-fg)'
    }
  }, "R$ 220"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "pago"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-4)'
    }
  }, "Como foi o trabalho?"), /*#__PURE__*/React.createElement(Rating, {
    editable: true,
    value: nota,
    onChange: setNota
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-strong)',
      marginBottom: 'var(--space-3)'
    }
  }, "O que funcionou bem"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)'
    }
  }, opcoes.map(function (t) {
    return /*#__PURE__*/React.createElement(Tag, {
      key: t,
      selected: tags.indexOf(t) >= 0,
      onClick: function () {
        alterna(t);
      }
    }, t);
  }))), /*#__PURE__*/React.createElement(Input, {
    label: "Quer escrever algo? (opcional)",
    placeholder: "S\xF3 o que ajudar outra construtora a decidir"
  }), /*#__PURE__*/React.createElement(Card, {
    tone: "sunken",
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "eye",
    size: 18,
    color: "var(--text-muted)",
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "A nota aparece no perfil do pedreiro. O coment\xE1rio aparece com o nome da sua construtora."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--gutter)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-bar)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    disabled: nota === 0,
    onClick: function () {
      setOk(true);
      window.setTimeout(function () {
        go('painel');
      }, 1100);
    }
  }, "Enviar avalia\xE7\xE3o")), ok ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--gutter)',
      right: 'var(--gutter)',
      bottom: 92
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "success"
  }, "Avalia\xE7\xE3o enviada. Obrigado.")) : null);
}
Object.assign(window, {
  AvaliarPedreiro
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_construtora/AvaliarPedreiro.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_construtora/Candidatos.jsx
try { (() => {
const CANDIDATOS = [{
  nome: 'José Carlos Silva',
  role: 'Pedreiro · 12 anos de obra',
  nota: 4.8,
  feitas: 32,
  dist: '2,4 km',
  status: 'aguardando'
}, {
  nome: 'Antônio Ferreira',
  role: 'Pedreiro · 20 anos de obra',
  nota: 4.6,
  feitas: 18,
  dist: '8,0 km',
  status: 'aguardando'
}, {
  nome: 'Marcos Pereira',
  role: 'Servente · 3 anos de obra',
  novo: true,
  dist: '5,1 km',
  status: 'aguardando'
}, {
  nome: 'Reginaldo Souza',
  role: 'Pedreiro · 7 anos de obra',
  nota: 4.9,
  feitas: 41,
  dist: '3,7 km',
  status: 'aprovado'
}, {
  nome: 'Edvaldo Lima',
  role: 'Pedreiro · 5 anos de obra',
  nota: 3.9,
  feitas: 9,
  dist: '11,2 km',
  status: 'recusado'
}];
function Candidatos({
  go,
  state
}) {
  const {
    AppBar,
    BottomNav,
    Tabs,
    CandidateRow,
    Card,
    Icon,
    Dialog,
    Toast,
    EmptyState,
    Badge
  } = window.BicosDesignSystem_dedf03;
  const vaga = state.vaga || {
    role: 'Pedreiro de acabamento',
    site: 'Obra Tatuapé — Torre B',
    pay: 'R$ 220',
    date: 'Hoje · 7h–17h'
  };
  const [tab, setTab] = React.useState('aguardando');
  const [lista, setLista] = React.useState(CANDIDATOS);
  const [confirmar, setConfirmar] = React.useState(null);
  const [aviso, setAviso] = React.useState('');
  const filtrados = lista.filter(function (c) {
    return c.status === tab;
  });
  function decidir(nome, status) {
    setLista(lista.map(function (c) {
      return c.nome === nome ? Object.assign({}, c, {
        status: status
      }) : c;
    }));
    setAviso(status === 'aprovado' ? 'Pedreiro aprovado. Avisamos por WhatsApp.' : 'Candidato recusado.');
    window.setTimeout(function () {
      setAviso('');
    }, 2200);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    tone: "plain",
    title: "Candidatos",
    subtitle: vaga.role,
    onBack: function () {
      go('painel');
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--gutter)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "sunken",
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 20,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, vaga.date), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, vaga.site || vaga.company)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-numeric)',
      color: 'var(--money-fg)'
    }
  }, vaga.pay), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "di\xE1ria"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "brand",
    dot: true
  }, "2 de 2 contratados"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "Encerre a vaga quando estiver completa"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--gutter)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      id: 'aguardando',
      label: 'Novos',
      count: lista.filter(function (c) {
        return c.status === 'aguardando';
      }).length
    }, {
      id: 'aprovado',
      label: 'Aprovados',
      count: lista.filter(function (c) {
        return c.status === 'aprovado';
      }).length
    }, {
      id: 'recusado',
      label: 'Recusados',
      count: lista.filter(function (c) {
        return c.status === 'recusado';
      }).length
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, filtrados.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "user-x",
    title: "Ningu\xE9m por aqui",
    description: "Quando algu\xE9m se candidatar, aparece nesta lista."
  }) : filtrados.map(function (c) {
    return /*#__PURE__*/React.createElement(CandidateRow, {
      key: c.nome,
      name: c.nome,
      role: c.role,
      rating: c.nota,
      jobsDone: c.feitas,
      distance: c.dist,
      isNew: c.novo,
      status: tab === 'aguardando' ? undefined : c.status,
      onApprove: tab === 'aguardando' ? function () {
        setConfirmar(c);
      } : undefined,
      onRefuse: tab === 'aguardando' ? function () {
        decidir(c.nome, 'recusado');
      } : undefined
    });
  })), /*#__PURE__*/React.createElement(BottomNav, {
    value: "candidatos",
    onChange: function (id) {
      go(id === 'vagas' ? 'painel' : id === 'candidatos' ? 'candidatos' : id === 'avaliar' ? 'avaliar' : 'empresa');
    },
    items: [{
      id: 'vagas',
      icon: 'clipboard-list',
      label: 'Vagas'
    }, {
      id: 'candidatos',
      icon: 'users',
      label: 'Candidatos',
      badge: 3
    }, {
      id: 'avaliar',
      icon: 'star',
      label: 'Avaliar',
      badge: 1
    }, {
      id: 'empresa',
      icon: 'building-2',
      label: 'Empresa'
    }]
  }), /*#__PURE__*/React.createElement(Dialog, {
    open: Boolean(confirmar),
    title: confirmar ? 'Contratar ' + confirmar.nome.split(' ')[0] + '?' : '',
    description: "Ele recebe o endere\xE7o da obra e o hor\xE1rio por WhatsApp. Voc\xEA pode desmarcar at\xE9 12 horas antes.",
    confirmLabel: "Sim, contratar",
    cancelLabel: "Voltar",
    onConfirm: function () {
      decidir(confirmar.nome, 'aprovado');
      setConfirmar(null);
    },
    onCancel: function () {
      setConfirmar(null);
    }
  }), aviso ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--gutter)',
      right: 'var(--gutter)',
      bottom: 80
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "success"
  }, aviso)) : null);
}
Object.assign(window, {
  Candidatos,
  CANDIDATOS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_construtora/Candidatos.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_construtora/PainelVagas.jsx
try { (() => {
const MINHAS_VAGAS = [{
  id: 1,
  role: 'Pedreiro de acabamento',
  site: 'Obra Tatuapé — Torre B',
  pay: 'R$ 220',
  date: 'Hoje · 7h–17h',
  applicants: 6,
  status: 'aberta',
  novos: 3
}, {
  id: 2,
  role: 'Servente',
  site: 'Obra Vila Prudente',
  pay: 'R$ 150',
  date: 'Qua, 9 set',
  applicants: 11,
  status: 'aberta',
  novos: 0
}, {
  id: 3,
  role: 'Armador',
  site: 'Obra Penha',
  pay: 'R$ 240',
  date: 'Sex, 11 set',
  applicants: 2,
  status: 'aberta',
  novos: 1
}, {
  id: 4,
  role: 'Azulejista',
  site: 'Reforma Anália Franco',
  pay: 'R$ 260',
  date: '28 ago',
  applicants: 8,
  status: 'encerrada',
  novos: 0
}];
function PainelVagas({
  go
}) {
  const {
    AppBar,
    BottomNav,
    Tabs,
    JobCard,
    Button,
    Card,
    Icon,
    Badge,
    EmptyState
  } = window.BicosDesignSystem_dedf03;
  const [tab, setTab] = React.useState('abertas');
  const lista = MINHAS_VAGAS.filter(function (v) {
    return tab === 'abertas' ? v.status === 'aberta' : v.status === 'encerrada';
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: "Construtora Meridiano",
    subtitle: "3 vagas abertas \xB7 19 candidatos",
    actions: [{
      icon: 'bell',
      label: 'Avisos'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--gutter)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "brand",
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 22,
    color: "var(--text-brand)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, "4 candidatos novos"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "Responda hoje para n\xE3o perder o pedreiro")), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: function () {
      go('candidatos', MINHAS_VAGAS[0]);
    }
  }, "Ver")), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    iconLeft: "plus",
    onClick: function () {
      go('publicar');
    }
  }, "Publicar vaga")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--gutter)',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onChange: setTab,
    items: [{
      id: 'abertas',
      label: 'Abertas',
      count: 3
    }, {
      id: 'encerradas',
      label: 'Encerradas',
      count: 1
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, lista.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "clipboard-list",
    title: "Nenhuma vaga encerrada",
    description: "As vagas aparecem aqui depois que voc\xEA encerra o dia."
  }) : lista.map(function (v) {
    return /*#__PURE__*/React.createElement("div", {
      key: v.id,
      style: {
        position: 'relative'
      }
    }, v.novos ? /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 1
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "brand",
      variant: "solid"
    }, v.novos, " novos")) : null, /*#__PURE__*/React.createElement(JobCard, {
      role: v.role,
      company: v.site,
      pay: v.pay,
      date: v.date,
      applicants: v.applicants,
      status: v.status,
      onClick: function () {
        go('candidatos', v);
      }
    }));
  })), /*#__PURE__*/React.createElement(BottomNav, {
    value: "vagas",
    onChange: function (id) {
      go(id === 'vagas' ? 'painel' : id === 'candidatos' ? 'candidatos' : id === 'avaliar' ? 'avaliar' : 'empresa');
    },
    items: [{
      id: 'vagas',
      icon: 'clipboard-list',
      label: 'Vagas'
    }, {
      id: 'candidatos',
      icon: 'users',
      label: 'Candidatos',
      badge: 4
    }, {
      id: 'avaliar',
      icon: 'star',
      label: 'Avaliar',
      badge: 1
    }, {
      id: 'empresa',
      icon: 'building-2',
      label: 'Empresa'
    }]
  }));
}
Object.assign(window, {
  PainelVagas,
  MINHAS_VAGAS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_construtora/PainelVagas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_construtora/PerfilConstrutora.jsx
try { (() => {
function PerfilConstrutora({
  go,
  state,
  setState
}) {
  const {
    AppBar,
    BottomNav,
    Card,
    Rating,
    Switch,
    Button,
    Badge,
    Icon,
    Tag
  } = window.BicosDesignSystem_dedf03;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: "Minha empresa",
    actions: [{
      icon: 'pencil',
      label: 'Editar dados'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 72,
      height: 72,
      borderRadius: 'var(--radius-2)',
      background: 'var(--brand-subtle)',
      color: 'var(--text-brand)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "building-2",
    size: 34
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-heading)'
    }
  }, "Construtora Meridiano"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "CNPJ 12.345.678/0001-90"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Rating, {
    value: 4.7,
    count: 64
  })))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)'
    }
  }, [['64', 'diárias pagas'], ['4,7', 'nota da obra'], ['1h20', 'resposta média']].map(function (m) {
    return /*#__PURE__*/React.createElement("div", {
      key: m[1],
      style: {
        flex: 1,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-numeric)',
        color: 'var(--text-strong)'
      }
    }, m[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-meta)',
        color: 'var(--text-muted)'
      }
    }, m[1]));
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 24,
    color: "var(--green-500)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, "Empresa verificada"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "CNPJ e respons\xE1vel conferidos")), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Ok")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "Obras ativas"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "map-pin"
  }, "Tatuap\xE9 \u2014 Torre B"), /*#__PURE__*/React.createElement(Tag, {
    icon: "map-pin"
  }, "Vila Prudente"), /*#__PURE__*/React.createElement(Tag, {
    icon: "map-pin"
  }, "Penha"), /*#__PURE__*/React.createElement(Tag, {
    icon: "plus"
  }, "Adicionar obra"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "Avisos"), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Avisar quando algu\xE9m se candidatar",
    checked: state.push !== false,
    onChange: function (e) {
      setState({
        push: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Resumo di\xE1rio por WhatsApp",
    description: "Todo dia \xE0s 18h",
    checked: Boolean(state.resumo),
    onChange: function (e) {
      setState({
        resumo: e.target.checked
      });
    }
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    fullWidth: true,
    iconLeft: "log-out",
    onClick: function () {
      go('painel');
    }
  }, "Sair da conta")), /*#__PURE__*/React.createElement(BottomNav, {
    value: "empresa",
    onChange: function (id) {
      go(id === 'vagas' ? 'painel' : id === 'candidatos' ? 'candidatos' : id === 'avaliar' ? 'avaliar' : 'empresa');
    },
    items: [{
      id: 'vagas',
      icon: 'clipboard-list',
      label: 'Vagas'
    }, {
      id: 'candidatos',
      icon: 'users',
      label: 'Candidatos',
      badge: 4
    }, {
      id: 'avaliar',
      icon: 'star',
      label: 'Avaliar',
      badge: 1
    }, {
      id: 'empresa',
      icon: 'building-2',
      label: 'Empresa'
    }]
  }));
}
Object.assign(window, {
  PerfilConstrutora
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_construtora/PerfilConstrutora.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_construtora/PublicarVaga.jsx
try { (() => {
function PublicarVaga({
  go
}) {
  const {
    AppBar,
    Button,
    Input,
    Select,
    Checkbox,
    Card,
    Icon,
    Toast,
    Tabs
  } = window.BicosDesignSystem_dedf03;
  const [passo, setPasso] = React.useState(1);
  const [erro, setErro] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    tone: "plain",
    title: "Publicar vaga",
    subtitle: 'Passo ' + passo + ' de 2',
    onBack: function () {
      passo === 1 ? go('painel') : setPasso(1);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: 'var(--surface-sunken)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      width: passo === 1 ? '50%' : '100%',
      background: 'var(--brand)',
      transition: 'width var(--dur-normal) var(--ease-standard)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, passo === 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
    label: "Fun\xE7\xE3o",
    options: ['Pedreiro de acabamento', 'Servente', 'Azulejista', 'Armador', 'Pintor'],
    defaultValue: "Pedreiro de acabamento"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Quantas pessoas",
    type: "number",
    defaultValue: "2",
    iconLeft: "users"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Valor da di\xE1ria",
    type: "number",
    defaultValue: "220",
    iconLeft: "banknote",
    suffix: "por dia",
    hint: "M\xE9dia da sua regi\xE3o: R$ 205",
    error: erro ? 'Informe um valor de R$ 80 ou mais.' : undefined
  }), /*#__PURE__*/React.createElement(Card, {
    tone: "sunken",
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'flex-start',
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 18,
    color: "var(--text-muted)",
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "Vagas com valor acima da m\xE9dia da regi\xE3o recebem candidatos em at\xE9 2 horas."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    label: "Data",
    type: "date",
    defaultValue: "2026-09-08",
    iconLeft: "calendar"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Come\xE7a",
    type: "time",
    defaultValue: "07:00",
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Termina",
    type: "time",
    defaultValue: "17:00",
    style: {
      flex: 1
    }
  })), /*#__PURE__*/React.createElement(Input, {
    label: "Endere\xE7o da obra",
    iconLeft: "map-pin",
    defaultValue: "R. Serra de Bragan\xE7a, 1240 \u2014 Tatuap\xE9"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "O que precisa fazer",
    defaultValue: "Reboco e acabamento em dois apartamentos",
    hint: "Escreva do jeito que se fala na obra."
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-strong)',
      marginBottom: 'var(--space-2)'
    }
  }, "Condi\xE7\xF5es"), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Material no local",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Pagamento por PIX no fim do dia",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Fornecemos EPI"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--gutter)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-bar)',
      display: 'flex',
      gap: 'var(--space-3)'
    }
  }, passo === 2 ? /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    onClick: function () {
      setPasso(1);
    }
  }, "Voltar") : null, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    loading: enviado,
    onClick: function () {
      if (passo === 1) {
        setErro(false);
        setPasso(2);
      } else {
        setEnviado(true);
        window.setTimeout(function () {
          setEnviado(false);
          go('painel');
        }, 900);
      }
    }
  }, passo === 1 ? 'Continuar' : 'Publicar vaga')), erro ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--gutter)',
      right: 'var(--gutter)',
      bottom: 92
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "danger",
    onClose: function () {
      setErro(false);
    }
  }, "Confira o valor da di\xE1ria.")) : null);
}
Object.assign(window, {
  PublicarVaga
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_construtora/PublicarVaga.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/DetalheVaga.jsx
try { (() => {
function DetalheVaga({
  go,
  state
}) {
  const {
    AppBar,
    Button,
    Badge,
    Card,
    Tag,
    Icon,
    Rating,
    Dialog,
    Toast
  } = window.BicosDesignSystem_dedf03;
  const v = state.vaga || {
    role: 'Pedreiro de acabamento',
    company: 'Construtora Meridiano',
    pay: 'R$ 220',
    location: 'Tatuapé, SP',
    distance: '3,2 km',
    date: 'Hoje · 7h–17h',
    urgent: true
  };
  const [ask, setAsk] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  function linha(icon, label, value) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-4)',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 20,
      color: "var(--text-subtle)",
      style: {
        marginTop: 2
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-meta)',
        color: 'var(--text-muted)'
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-body-strong)',
        color: 'var(--text-strong)'
      }
    }, value)));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    tone: "plain",
    title: "Detalhe da vaga",
    onBack: function () {
      go('mural');
    },
    actions: [{
      icon: 'share-2',
      label: 'Compartilhar'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      marginBottom: 'var(--space-3)'
    }
  }, v.urgent ? /*#__PURE__*/React.createElement(Badge, {
    tone: "danger",
    icon: "zap"
  }, "Come\xE7a hoje") : null, /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Aberta")), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: 'var(--type-title)',
      color: 'var(--text-strong)'
    }
  }, v.role), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      marginTop: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-body)'
    }
  }, v.company), /*#__PURE__*/React.createElement(Rating, {
    value: 4.7,
    count: 64,
    size: 14
  }))), /*#__PURE__*/React.createElement(Card, {
    tone: "brand",
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "Voc\xEA recebe"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-bold) var(--size-30)/1.1 var(--font-mono)',
      color: 'var(--money-fg)'
    }
  }, v.pay), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, "por di\xE1ria \xB7 pagamento por PIX no fim do dia")), /*#__PURE__*/React.createElement(Icon, {
    name: "banknote",
    size: 32,
    color: "var(--brand)"
  })), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, linha('calendar', 'Quando', v.date), linha('map-pin', 'Onde', v.location + ' · ' + v.distance + ' de você'), linha('users', 'Quantas pessoas', '2 pedreiros · 6 já se candidataram')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "O que precisa fazer"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: 'var(--text-body)'
    }
  }, "Reboco e acabamento em dois apartamentos do 4\xBA andar. A obra tem elevador de carga, andaime e material no local.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "Voc\xEA precisa levar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "wrench"
  }, "Colher e desempenadeira"), /*#__PURE__*/React.createElement(Tag, {
    icon: "hard-hat"
  }, "Botina"), /*#__PURE__*/React.createElement(Tag, {
    icon: "shield"
  }, "EPI pr\xF3prio"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--gutter)',
      background: 'var(--surface-card)',
      boxShadow: 'var(--shadow-bar)'
    }
  }, enviado ? /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    disabled: true,
    iconLeft: "check"
  }, "Candidatura enviada") : /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    iconLeft: "hand-coins",
    onClick: function () {
      setAsk(true);
    }
  }, "Quero esse bico"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)',
      textAlign: 'center',
      marginTop: 'var(--space-3)'
    }
  }, "Sem taxa para o trabalhador.")), /*#__PURE__*/React.createElement(Dialog, {
    open: ask,
    title: "Confirmar candidatura?",
    description: "A construtora vai ver seu nome, sua nota e seu telefone. Voc\xEA recebe a resposta por aqui e no WhatsApp.",
    confirmLabel: "Sim, quero o bico",
    cancelLabel: "Voltar",
    onConfirm: function () {
      setAsk(false);
      setEnviado(true);
    },
    onCancel: function () {
      setAsk(false);
    }
  }), enviado ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--gutter)',
      right: 'var(--gutter)',
      bottom: 96
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "success",
    onClose: function () {
      setEnviado(true);
    }
  }, "Candidatura enviada.")) : null);
}
Object.assign(window, {
  DetalheVaga
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/DetalheVaga.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/Entrada.jsx
try { (() => {
function Entrada({
  go
}) {
  const {
    Button,
    Input,
    Card,
    Icon
  } = window.BicosDesignSystem_dedf03;
  const [step, setStep] = React.useState('fone');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--blue-500)',
      padding: 'var(--space-9) var(--gutter) var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-bold) 44px/1 var(--font-display)',
      letterSpacing: '-0.04em',
      color: '#fff'
    }
  }, "Bicos"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--weight-medium) var(--size-12)/1.4 var(--font-body)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.85)',
      marginTop: 6
    }
  }, "por NivoTech"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-body)',
      color: '#fff',
      marginTop: 'var(--space-6)',
      maxWidth: 260
    }
  }, "Trabalho de di\xE1ria na constru\xE7\xE3o, perto de voc\xEA.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, step === 'fone' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    label: "Seu celular",
    type: "tel",
    iconLeft: "phone",
    defaultValue: "(11) 98472-1130",
    hint: "Mandamos um c\xF3digo por SMS. \xC9 de gra\xE7a."
  }), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    onClick: () => setStep('codigo')
  }, "Continuar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-subtle)'
    }
  }, "ou"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border)'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg",
    fullWidth: true,
    iconLeft: "message-circle",
    onClick: () => setStep('codigo')
  }, "Entrar com WhatsApp")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    tone: "brand",
    padding: "var(--space-4)",
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-dot",
    size: 20,
    color: "var(--text-brand)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-body)'
    }
  }, "Enviamos um c\xF3digo de 4 n\xFAmeros para (11) 98472-1130.")), /*#__PURE__*/React.createElement(Input, {
    label: "C\xF3digo do SMS",
    type: "tel",
    defaultValue: "4821",
    inputStyle: {
      font: 'var(--weight-bold) var(--size-24)/1 var(--font-mono)',
      letterSpacing: '0.3em'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    onClick: () => go('perfil')
  }, "Entrar"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    fullWidth: true,
    onClick: () => setStep('fone')
  }, "Mudar o n\xFAmero")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-meta)',
      color: 'var(--text-muted)',
      marginTop: 'auto'
    }
  }, "Ao entrar voc\xEA aceita os ", /*#__PURE__*/React.createElement("a", {
    href: "#termos"
  }, "termos de uso"), " e a pol\xEDtica de privacidade.")));
}
Object.assign(window, {
  Entrada
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/Entrada.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/MinhasCandidaturas.jsx
try { (() => {
function MinhasCandidaturas({
  go
}) {
  const {
    AppBar,
    BottomNav,
    Tabs,
    JobCard,
    EmptyState
  } = window.BicosDesignSystem_dedf03;
  const [tab, setTab] = React.useState('andamento');
  const andamento = [{
    role: 'Pedreiro de acabamento',
    company: 'Construtora Meridiano',
    pay: 'R$ 220',
    date: 'Hoje · 7h–17h',
    status: 'contratado'
  }, {
    role: 'Servente',
    company: 'Obra Vila Prudente',
    pay: 'R$ 150',
    date: 'Qua, 9 set',
    status: 'aguardando'
  }, {
    role: 'Armador',
    company: 'Construtora Meridiano',
    pay: 'R$ 240',
    date: 'Sex, 11 set',
    status: 'aguardando'
  }];
  const encerradas = [{
    role: 'Azulejista',
    company: 'Reforma Anália Franco',
    pay: 'R$ 260',
    date: '28 ago',
    status: 'encerrada'
  }, {
    role: 'Pedreiro',
    company: 'Obra Penha',
    pay: 'R$ 200',
    date: '21 ago',
    status: 'recusada'
  }];
  const lista = tab === 'andamento' ? andamento : encerradas;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: "Minhas candidaturas"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--gutter) 0',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "segmented",
    value: tab,
    onChange: setTab,
    items: [{
      id: 'andamento',
      label: 'Em andamento'
    }, {
      id: 'encerradas',
      label: 'Encerradas'
    }],
    style: {
      marginBottom: 'var(--space-4)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, lista.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "file-search",
    title: "Voc\xEA ainda n\xE3o se candidatou",
    description: "Toque em Vagas para ver os bicos abertos perto de voc\xEA.",
    actionLabel: "Ver vagas",
    onAction: function () {
      go('mural');
    }
  }) : lista.map(function (v, i) {
    return /*#__PURE__*/React.createElement(JobCard, {
      key: i,
      role: v.role,
      company: v.company,
      pay: v.pay,
      date: v.date,
      status: v.status,
      onClick: function () {
        go('vaga', v);
      }
    });
  })), /*#__PURE__*/React.createElement(BottomNav, {
    value: "minhas",
    onChange: function (id) {
      go(id === 'vagas' ? 'mural' : id === 'minhas' ? 'minhas' : 'perfil');
    },
    items: [{
      id: 'vagas',
      icon: 'hammer',
      label: 'Vagas'
    }, {
      id: 'minhas',
      icon: 'file-check',
      label: 'Minhas',
      badge: 2
    }, {
      id: 'perfil',
      icon: 'user',
      label: 'Perfil'
    }]
  }));
}
Object.assign(window, {
  MinhasCandidaturas
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/MinhasCandidaturas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/MuralVagas.jsx
try { (() => {
const VAGAS = [{
  id: 1,
  role: 'Pedreiro de acabamento',
  company: 'Construtora Meridiano',
  pay: 'R$ 220',
  location: 'Tatuapé, SP',
  distance: '3,2 km',
  date: 'Hoje · 7h–17h',
  urgent: true
}, {
  id: 2,
  role: 'Servente',
  company: 'Obra Vila Prudente',
  pay: 'R$ 150',
  location: 'Vila Prudente',
  distance: '6,8 km',
  date: 'Qua, 9 set · 7h–16h'
}, {
  id: 3,
  role: 'Azulejista',
  company: 'Reforma Rua Serra de Bragança',
  pay: 'R$ 260',
  location: 'Tatuapé, SP',
  distance: '4,1 km',
  date: 'Qui, 10 set · 8h–17h'
}, {
  id: 4,
  role: 'Armador',
  company: 'Construtora Meridiano',
  pay: 'R$ 240',
  location: 'Penha, SP',
  distance: '9,5 km',
  date: 'Sex, 11 set · 7h–17h'
}];
function MuralVagas({
  go,
  state
}) {
  const {
    AppBar,
    BottomNav,
    Input,
    Tag,
    JobCard,
    EmptyState,
    Skeleton,
    Card,
    Icon,
    Toast
  } = window.BicosDesignSystem_dedf03;
  const [filtro, setFiltro] = React.useState('perto');
  const [loading, setLoading] = React.useState(false);
  const lista = filtro === 'hoje' ? VAGAS.filter(function (v) {
    return v.urgent;
  }) : filtro === 'acabamento' ? [] : VAGAS;
  function troca(id) {
    setFiltro(id);
    setLoading(true);
    window.setTimeout(function () {
      setLoading(false);
    }, 550);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: "Bicos perto de voc\xEA",
    subtitle: "S\xE3o Paulo \xB7 Zona Leste",
    actions: [{
      icon: 'bell',
      label: 'Avisos'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-4) var(--gutter)',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Buscar fun\xE7\xE3o ou bairro",
    iconLeft: "search",
    "aria-label": "Buscar vaga"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-3)',
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "map-pin",
    selected: filtro === 'perto',
    onClick: function () {
      troca('perto');
    }
  }, "Perto de mim"), /*#__PURE__*/React.createElement(Tag, {
    icon: "zap",
    selected: filtro === 'hoje',
    onClick: function () {
      troca('hoje');
    }
  }, "Come\xE7a hoje"), /*#__PURE__*/React.createElement(Tag, {
    selected: filtro === 'acabamento',
    onClick: function () {
      troca('acabamento');
    }
  }, "Acabamento"), /*#__PURE__*/React.createElement(Tag, {
    icon: "sliders-horizontal",
    onClick: function () {}
  }, "Filtros"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, state.offline ? /*#__PURE__*/React.createElement(Toast, {
    tone: "offline"
  }, "Sem internet. Mostrando as vagas salvas.") : null, loading ? [0, 1, 2].map(function (i) {
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      padding: "var(--space-5)"
    }, /*#__PURE__*/React.createElement(Skeleton, {
      height: 20,
      width: "65%"
    }), /*#__PURE__*/React.createElement(Skeleton, {
      height: 14,
      width: "45%",
      style: {
        marginTop: 10
      }
    }), /*#__PURE__*/React.createElement(Skeleton, {
      height: 14,
      width: "80%",
      style: {
        marginTop: 14
      }
    }));
  }) : lista.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    icon: "search-x",
    title: "Nenhuma vaga de acabamento hoje",
    description: "Tire o filtro ou aumente a dist\xE2ncia para ver mais bicos.",
    actionLabel: "Limpar filtros",
    onAction: function () {
      troca('perto');
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--type-overline)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, lista.length, " vagas abertas"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--type-meta)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-down-up",
    size: 14,
    color: "var(--text-subtle)"
  }), "Mais perto")), lista.map(function (v) {
    return /*#__PURE__*/React.createElement(JobCard, {
      key: v.id,
      role: v.role,
      company: v.company,
      pay: v.pay,
      location: v.location,
      distance: v.distance,
      date: v.date,
      urgent: v.urgent,
      onClick: function () {
        go('vaga', v);
      }
    });
  }))), /*#__PURE__*/React.createElement(BottomNav, {
    value: "vagas",
    onChange: function (id) {
      go(id === 'vagas' ? 'mural' : id === 'minhas' ? 'minhas' : 'perfil');
    },
    items: [{
      id: 'vagas',
      icon: 'hammer',
      label: 'Vagas'
    }, {
      id: 'minhas',
      icon: 'file-check',
      label: 'Minhas',
      badge: 2
    }, {
      id: 'perfil',
      icon: 'user',
      label: 'Perfil'
    }]
  }));
}
Object.assign(window, {
  MuralVagas,
  VAGAS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/MuralVagas.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/PerfilPedreiro.jsx
try { (() => {
function PerfilPedreiro({
  go,
  state,
  setState
}) {
  const {
    AppBar,
    BottomNav,
    Card,
    Tag,
    Rating,
    Switch,
    Button,
    Badge,
    Icon
  } = window.BicosDesignSystem_dedf03;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    title: "Meu perfil",
    actions: [{
      icon: 'pencil',
      label: 'Editar perfil'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 72,
      height: 72,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--accent-subtle)',
      color: 'var(--teal-700)',
      font: 'var(--weight-bold) var(--size-24)/1 var(--font-body)'
    }
  }, "JC"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--type-heading)'
    }
  }, "Jos\xE9 Carlos Silva"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Pedreiro \xB7 12 anos de obra"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Rating, {
    value: 4.8,
    count: 32
  })))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      gap: 'var(--space-4)'
    }
  }, [['32', 'diárias feitas'], ['4,8', 'nota média'], ['98%', 'presença']].map(function (m) {
    return /*#__PURE__*/React.createElement("div", {
      key: m[1],
      style: {
        flex: 1,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-numeric)',
        color: 'var(--text-strong)'
      }
    }, m[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        font: 'var(--type-meta)',
        color: 'var(--text-muted)'
      }
    }, m[1]));
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "O que eu fa\xE7o"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--space-3)'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "wrench"
  }, "Alvenaria"), /*#__PURE__*/React.createElement(Tag, {
    icon: "wrench"
  }, "Reboco"), /*#__PURE__*/React.createElement(Tag, {
    icon: "wrench"
  }, "Contrapiso"), /*#__PURE__*/React.createElement(Tag, {
    icon: "plus"
  }, "Adicionar"))), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-check",
    size: 24,
    color: "var(--green-500)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-body-strong)',
      color: 'var(--text-strong)'
    }
  }, "Documentos verificados"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "RG e CPF conferidos em 12 ago")), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    dot: true
  }, "Ok")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      marginBottom: 'var(--space-3)'
    }
  }, "Avisos"), /*#__PURE__*/React.createElement(Card, {
    padding: "var(--space-5)",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Avisar por WhatsApp",
    description: "Novas vagas at\xE9 10 km",
    checked: state.zap !== false,
    onChange: function (e) {
      setState({
        zap: e.target.checked
      });
    }
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "S\xF3 vagas que come\xE7am hoje",
    description: "Menos avisos, mais urg\xEAncia",
    checked: Boolean(state.hoje),
    onChange: function (e) {
      setState({
        hoje: e.target.checked
      });
    }
  }))), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    fullWidth: true,
    iconLeft: "log-out",
    onClick: function () {
      go('entrada');
    }
  }, "Sair da conta")), /*#__PURE__*/React.createElement(BottomNav, {
    value: "perfil",
    onChange: function (id) {
      go(id === 'vagas' ? 'mural' : id === 'minhas' ? 'minhas' : 'perfil');
    },
    items: [{
      id: 'vagas',
      icon: 'hammer',
      label: 'Vagas'
    }, {
      id: 'minhas',
      icon: 'file-check',
      label: 'Minhas',
      badge: 2
    }, {
      id: 'perfil',
      icon: 'user',
      label: 'Perfil'
    }]
  }));
}
Object.assign(window, {
  PerfilPedreiro
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/PerfilPedreiro.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app_pedreiro/SelecaoPerfil.jsx
try { (() => {
function SelecaoPerfil({
  go
}) {
  const {
    Button,
    Radio,
    AppBar
  } = window.BicosDesignSystem_dedf03;
  const [perfil, setPerfil] = React.useState('pedreiro');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(AppBar, {
    tone: "plain",
    title: "Como voc\xEA vai usar o Bicos?"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 'var(--gutter)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--type-small)',
      color: 'var(--text-muted)'
    }
  }, "D\xE1 para trocar depois no seu perfil."), /*#__PURE__*/React.createElement(Radio, {
    card: true,
    icon: "hard-hat",
    name: "perfil",
    label: "Sou pedreiro",
    description: "Quero achar bico perto de mim",
    checked: perfil === 'pedreiro',
    onChange: () => setPerfil('pedreiro')
  }), /*#__PURE__*/React.createElement(Radio, {
    card: true,
    icon: "building-2",
    name: "perfil",
    label: "Sou construtora",
    description: "Preciso contratar por di\xE1ria",
    checked: perfil === 'construtora',
    onChange: () => setPerfil('construtora')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    fullWidth: true,
    iconRight: "arrow-right",
    onClick: () => go(perfil === 'pedreiro' ? 'mural' : 'construtora')
  }, "Continuar"))));
}
Object.assign(window, {
  SelecaoPerfil
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app_pedreiro/SelecaoPerfil.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.CandidateRow = __ds_scope.CandidateRow;

__ds_ns.JobCard = __ds_scope.JobCard;

__ds_ns.Rating = __ds_scope.Rating;

__ds_ns.AppBar = __ds_scope.AppBar;

__ds_ns.BottomNav = __ds_scope.BottomNav;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
