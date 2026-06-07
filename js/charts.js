/* js/charts.js */

// Helper to convert polar coordinates to cartesian for SVG pathing
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
}

// Generates path string for an arc segment
function getArcPath(x, y, radius, startAngle, endAngle) {
  // If a full circle is close to being completed
  if (endAngle - startAngle >= 359.9) {
    endAngle = startAngle + 359.9;
  }
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ');
}

export class Charts {
  /**
   * Renders a custom SVG donut chart representing spending by category
   */
  static renderDonutChart(containerId, transactions, categories) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Filter current month's expenses
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expenses = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      const tDate = new Date(t.date + 'T00:00:00');
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });

    const totalExpense = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Sum by category
    const catTotals = {};
    expenses.forEach(t => {
      const catId = t.categoryId || 'uncategorized';
      catTotals[catId] = (catTotals[catId] || 0) + parseFloat(t.amount);
    });

    // Match with category details
    let slices = [];
    let uncategorizedSum = catTotals['uncategorized'] || 0;
    
    categories.forEach(cat => {
      const amount = catTotals[cat.id] || 0;
      if (amount > 0) {
        slices.push({
          name: cat.name,
          emoji: cat.emoji,
          amount: amount,
          color: cat.color,
          percentage: (amount / totalExpense) * 100
        });
      }
    });

    if (uncategorizedSum > 0) {
      slices.push({
        name: 'Uncategorized',
        emoji: '🏷️',
        amount: uncategorizedSum,
        color: '#71717a',
        percentage: (uncategorizedSum / totalExpense) * 100
      });
    }

    // Sort slices by size
    slices.sort((a, b) => b.amount - a.amount);

    // If no data, render empty state
    if (totalExpense === 0) {
      container.innerHTML = `
        <div class="empty-chart-state">
          <div class="empty-chart-icon">📊</div>
          <p>No expenses logged this month</p>
        </div>
      `;
      return;
    }

    // Prepare SVG markup
    const size = 220;
    const center = size / 2;
    const radius = 75;
    const strokeWidth = 18;

    let svgContent = '';
    let currentAngle = 0;

    // Definitions for filters and gradients
    svgContent += `
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.15" />
        </filter>
      </defs>
    `;

    slices.forEach((slice, idx) => {
      const angleSize = (slice.amount / totalExpense) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSize;
      currentAngle = endAngle;

      const pathData = getArcPath(center, center, radius, startAngle, endAngle);
      
      // Inline styles for interactive segments
      svgContent += `
        <path
          d="${pathData}"
          fill="none"
          stroke="${slice.color}"
          stroke-width="${strokeWidth}"
          stroke-linecap="round"
          class="donut-segment"
          data-index="${idx}"
          style="transition: stroke-width 0.2s ease, filter 0.2s ease; cursor: pointer;"
        >
          <title>${slice.emoji} ${slice.name}: $${slice.amount.toFixed(2)} (${slice.percentage.toFixed(1)}%)</title>
        </path>
      `;
    });

    // Center text
    svgContent += `
      <circle cx="${center}" cy="${center}" r="${radius - strokeWidth/2 - 2}" fill="transparent" />
      <text x="${center}" y="${center - 6}" text-anchor="middle" class="chart-label-sub" fill="var(--text-secondary)" font-size="11" font-weight="500">EXPENSES</text>
      <text x="${center}" y="${center + 14}" text-anchor="middle" class="chart-label-val" fill="var(--text-primary)" font-size="18" font-weight="700">$${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</text>
    `;

    // Render columns: chart + custom detailed legend list
    let legendHtml = '<div class="chart-legend-list">';
    slices.forEach((slice) => {
      legendHtml += `
        <div class="chart-legend-item">
          <div class="legend-color-indicator" style="background-color: ${slice.color};"></div>
          <span class="legend-emoji">${slice.emoji}</span>
          <span class="legend-name">${slice.name}</span>
          <span class="legend-pct">${slice.percentage.toFixed(0)}%</span>
          <span class="legend-val">$${slice.amount.toFixed(2)}</span>
        </div>
      `;
    });
    legendHtml += '</div>';

    container.innerHTML = `
      <div class="donut-chart-wrapper">
        <div class="svg-container">
          <svg width="100%" height="100%" viewBox="0 0 ${size} ${size}">
            ${svgContent}
          </svg>
        </div>
        ${legendHtml}
      </div>
    `;

    // Bind hover interactions
    const segments = container.querySelectorAll('.donut-segment');
    const legendItems = container.querySelectorAll('.chart-legend-item');

    segments.forEach((seg, idx) => {
      seg.addEventListener('mouseenter', () => {
        seg.setAttribute('stroke-width', (strokeWidth + 4).toString());
        seg.setAttribute('filter', 'url(#shadow)');
        if (legendItems[idx]) {
          legendItems[idx].classList.add('highlighted');
        }
      });
      seg.addEventListener('mouseleave', () => {
        seg.setAttribute('stroke-width', strokeWidth.toString());
        seg.removeAttribute('filter');
        if (legendItems[idx]) {
          legendItems[idx].classList.remove('highlighted');
        }
      });
    });
  }

  /**
   * Renders a smooth cumulative cash flow (net worth trend) area chart
   */
  static renderAreaChart(containerId, transactions, daysLimit = 30) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 1. Generate array of dates for the last N days
    const dates = [];
    const dateStrings = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dates.push(d);
      dateStrings.push(str);
    }

    // 2. Determine net worth today (total balance of all accounts combined)
    const accounts = JSON.parse(localStorage.getItem('accounts') || '[]');
    let currentNetWorth = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

    // 3. Compute net worth backwards
    const netWorthByDate = {};
    netWorthByDate[dateStrings[daysLimit - 1]] = currentNetWorth;

    // Filter transactions relevant to calculations
    const sortedTxs = [...transactions]
      .filter(t => t.date <= dateStrings[daysLimit - 1])
      .sort((a, b) => b.date.localeCompare(a.date)); // Descending order (newest first)

    let txIdx = 0;
    
    // Step backwards day-by-day to reconstruct cumulative balances
    for (let i = daysLimit - 1; i >= 1; i--) {
      const dateStr = dateStrings[i];
      const prevDateStr = dateStrings[i - 1];
      
      let dayNetChange = 0;

      // Subtract transactions that happened on dateStr (going backward in time)
      while (txIdx < sortedTxs.length && sortedTxs[txIdx].date === dateStr) {
        const tx = sortedTxs[txIdx];
        const amt = parseFloat(tx.amount);
        if (tx.type === 'expense') {
          dayNetChange -= amt; // subtraction of expenses going forward means addition going backward
        } else if (tx.type === 'income') {
          dayNetChange += amt; // addition of income going forward means subtraction going backward
        }
        // Transfers don't change net worth (they stay inside the system)
        txIdx++;
      }

      currentNetWorth = currentNetWorth - dayNetChange;
      netWorthByDate[prevDateStr] = parseFloat(currentNetWorth.toFixed(2));
    }

    // Compile points
    const pointsData = dateStrings.map(dateStr => {
      // In case we ran out of transactions, use the last calculated net worth
      if (netWorthByDate[dateStr] === undefined) {
        netWorthByDate[dateStr] = currentNetWorth;
      }
      return {
        date: dateStr,
        label: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: netWorthByDate[dateStr]
      };
    });

    // Chart Dimensions
    const width = 600;
    const height = 180;
    const padding = { top: 15, right: 15, bottom: 25, left: 50 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Find min and max values for scaling
    const values = pointsData.map(p => p.value);
    let maxVal = Math.max(...values);
    let minVal = Math.min(...values);

    // Padding for min/max
    const valRange = maxVal - minVal;
    maxVal = maxVal + (valRange * 0.1 || 100);
    minVal = minVal - (valRange * 0.1 || 100);
    if (minVal < 0 && Math.abs(minVal) < 100) minVal = -100; // grid snap

    const getX = (index) => padding.left + (index / (daysLimit - 1)) * chartWidth;
    const getY = (value) => {
      const pct = (value - minVal) / (maxVal - minVal);
      return padding.top + chartHeight - (pct * chartHeight);
    };

    // Build SVG parts
    let gridLines = '';
    let areaPath = '';
    let linePath = '';
    let dots = '';
    
    // Draw Grid Lines (Y axis, 3 divisions)
    const yDivs = 3;
    for (let i = 0; i <= yDivs; i++) {
      const val = minVal + (i / yDivs) * (maxVal - minVal);
      const y = getY(val);
      gridLines += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4 4" />
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="9" font-weight="500">$${Math.round(val)}</text>
      `;
    }

    // Build Line Path and Area Path
    if (pointsData.length > 0) {
      // Area Start: bottom left
      areaPath += `M ${getX(0)} ${padding.top + chartHeight} `;
      
      pointsData.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.value);

        if (idx === 0) {
          linePath += `M ${x} ${y} `;
          areaPath += `L ${x} ${y} `;
        } else {
          // Linear plot
          linePath += `L ${x} ${y} `;
          areaPath += `L ${x} ${y} `;
        }

        // Draw hover target nodes
        dots += `
          <g class="chart-point-group" style="cursor: pointer;">
            <circle cx="${x}" cy="${y}" r="3" fill="var(--primary)" stroke="var(--bg-app)" stroke-width="1.5" class="chart-point" />
            <circle cx="${x}" cy="${y}" r="8" fill="transparent" class="chart-point-trigger" data-date="${p.label}" data-val="$${p.value.toFixed(2)}" />
          </g>
        `;
      });

      // Area End: bottom right, then close path
      areaPath += `L ${getX(pointsData.length - 1)} ${padding.top + chartHeight} Z`;
    }

    // X Axis Labels (Draw 4 labels across the timeline)
    let xLabels = '';
    const labelSpacing = Math.floor(daysLimit / 4);
    for (let i = 0; i < daysLimit; i += labelSpacing) {
      if (pointsData[i]) {
        xLabels += `
          <text x="${getX(i)}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="500">${pointsData[i].label}</text>
        `;
      }
    }
    // Always draw the last label
    if ((daysLimit - 1) % labelSpacing !== 0) {
      xLabels += `
        <text x="${getX(daysLimit - 1)}" y="${height - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-weight="500">${pointsData[daysLimit - 1].label}</text>
      `;
    }

    container.innerHTML = `
      <div class="area-chart-wrapper">
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.0"/>
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <!-- Grid Lines -->
          ${gridLines}
          
          <!-- Area Under Line -->
          <path d="${areaPath}" fill="url(#chart-area-grad)" />
          
          <!-- Main Trend Line -->
          <path d="${linePath}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          
          <!-- Interactive Points -->
          ${dots}
          
          <!-- X Axis Text -->
          ${xLabels}
        </svg>
        <div class="chart-tooltip" style="opacity: 0; position: absolute; pointer-events: none; background: var(--bg-card); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: var(--radius-sm); color: var(--text-primary); font-size: 10px; font-weight: 600; box-shadow: var(--card-shadow); backdrop-filter: var(--card-blur); transition: opacity 0.15s ease, transform 0.1s ease;"></div>
      </div>
    `;

    // Tooltip interactivity
    const tooltip = container.querySelector('.chart-tooltip');
    const pointGroups = container.querySelectorAll('.chart-point-group');

    pointGroups.forEach(grp => {
      const trigger = grp.querySelector('.chart-point-trigger');
      const point = grp.querySelector('.chart-point');

      trigger.addEventListener('mouseenter', (e) => {
        point.setAttribute('r', '5');
        point.setAttribute('fill', 'var(--accent)');
        
        const date = trigger.getAttribute('data-date');
        const val = trigger.getAttribute('data-val');
        
        tooltip.innerHTML = `<span style="color:var(--text-secondary); font-weight:normal">${date}:</span> ${val}`;
        tooltip.style.opacity = '1';
        
        // Position tooltip relative to container
        const rect = container.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        
        const xPos = triggerRect.left - rect.left + triggerRect.width/2 - tooltip.offsetWidth/2;
        const yPos = triggerRect.top - rect.top - tooltip.offsetHeight - 8;
        
        tooltip.style.left = `${xPos}px`;
        tooltip.style.top = `${yPos}px`;
      });

      trigger.addEventListener('mouseleave', () => {
        point.setAttribute('r', '3');
        point.setAttribute('fill', 'var(--primary)');
        tooltip.style.opacity = '0';
      });
    });
  }
}
