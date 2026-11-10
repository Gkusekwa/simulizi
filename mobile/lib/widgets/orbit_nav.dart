import 'dart:math' as math;

import 'package:flutter/material.dart';

class OrbitItem {
  const OrbitItem({required this.icon, required this.label, this.badge = 0});
  final IconData icon;
  final String label;
  final int badge;
}

/// The orbit navigation from the mockups: one round button at the bottom
/// centre; tapping it fans the destinations out along an arc above it. The
/// current destination is shown on the hub so the user always knows where
/// they are; a long press jumps home. Items are 48 dp for touch.
class OrbitNav extends StatefulWidget {
  const OrbitNav({super.key, required this.items, required this.index, required this.onSelect, required this.menuLabel});
  final List<OrbitItem> items;
  final int index;
  final ValueChanged<int> onSelect;
  final String menuLabel;

  @override
  State<OrbitNav> createState() => _OrbitNavState();
}

class _OrbitNavState extends State<OrbitNav> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));
  late final Animation<double> _t = CurvedAnimation(parent: _c, curve: Curves.easeOutBack, reverseCurve: Curves.easeIn);
  bool get open => _c.status == AnimationStatus.forward || _c.status == AnimationStatus.completed;

  void toggle() => open ? _c.reverse() : _c.forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    const radius = 118.0;
    final n = widget.items.length;
    return AnimatedBuilder(
      animation: _t,
      builder: (context, _) {
        final t = _t.value.clamp(0.0, 1.0);
        return SizedBox(
          width: radius * 2 + 64,
          height: radius + 90,
          child: Stack(
            alignment: Alignment.bottomCenter,
            clipBehavior: Clip.none,
            children: [
              if (t > 0)
                Positioned.fill(
                  child: IgnorePointer(
                    ignoring: !open,
                    child: GestureDetector(behavior: HitTestBehavior.translucent, onTap: toggle),
                  ),
                ),
              for (var i = 0; i < n; i++)
                Builder(builder: (_) {
                  // Spread from 160° to 20° so the arc sits above the hub.
                  final angle = math.pi * (1 - (i + 1) / (n + 1));
                  final dx = math.cos(angle) * radius * t;
                  final dy = math.sin(angle) * radius * t;
                  final item = widget.items[i];
                  final active = i == widget.index;
                  return Positioned(
                    bottom: 12 + dy,
                    left: (radius * 2 + 64) / 2 - 24 + dx,
                    child: Opacity(
                      opacity: t,
                      child: Semantics(
                        button: true,
                        selected: active,
                        label: item.label,
                        child: Tooltip(
                          message: item.label,
                          child: Material(
                            color: active ? scheme.primary : scheme.surfaceContainerHighest,
                            shape: CircleBorder(side: BorderSide(color: scheme.outline)),
                            elevation: 2,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: () {
                                widget.onSelect(i);
                                _c.reverse();
                              },
                              child: SizedBox(
                                width: 48,
                                height: 48,
                                child: Stack(alignment: Alignment.center, children: [
                                  Icon(item.icon, size: 22, color: active ? scheme.onPrimary : scheme.onSurface),
                                  if (item.badge > 0)
                                    Positioned(
                                      top: 6,
                                      right: 6,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                        decoration: BoxDecoration(color: scheme.secondary, borderRadius: BorderRadius.circular(8)),
                                        child: Text('${item.badge}', style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.w700)),
                                      ),
                                    ),
                                ]),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              Positioned(
                bottom: 8,
                child: Semantics(
                  button: true,
                  label: widget.menuLabel,
                  child: Material(
                    color: scheme.onSurface,
                    shape: const CircleBorder(),
                    elevation: 6,
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: toggle,
                      onLongPress: () => widget.onSelect(0),
                      child: SizedBox(
                        width: 60,
                        height: 60,
                        child: Center(
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 180),
                            child: Icon(open ? Icons.close : widget.items[widget.index].icon, key: ValueKey(open ? -1 : widget.index), color: scheme.surface, size: 26),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
