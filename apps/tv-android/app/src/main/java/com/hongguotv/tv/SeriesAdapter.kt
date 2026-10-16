package com.hongguotv.tv

import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ProgressBar
import androidx.recyclerview.widget.RecyclerView

internal class SeriesAdapter(
    initialRows: List<Series>, private val artwork: ArtworkLoader,
    private val selected: (Series) -> Unit, private val focused: (Series) -> Unit,
    private val subtitle: (Series) -> String = { it.badge },
    private val progress: (Series) -> Float? = { null },
    private val isRank: Boolean = false
) : RecyclerView.Adapter<SeriesAdapter.Holder>() {
    private val rows: MutableList<Series> = initialRows.toMutableList()
    val currentRows: List<Series> get() = rows
    class Holder(
        val card: LinearLayout,
        val imageContainer: FrameLayout,
        val image: ImageView,
        val rankBadge: TextView,
        val title: TextView,
        val badge: TextView,
        val progress: ProgressBar
    ) : RecyclerView.ViewHolder(card) {
        private val rankRadius = TvUi.dimen(card.context, R.dimen.series_rank_badge_radius).toFloat()
        val rankBackgrounds = arrayOf(
            intArrayOf(0xffffd700.toInt(), 0xfff59e0b.toInt()),
            intArrayOf(0xffe2e8f0.toInt(), 0xff94a3b8.toInt()),
            intArrayOf(0xfff97316.toInt(), 0xffea580c.toInt()),
            intArrayOf(0xcc1e293b.toInt(), 0xaa0f172a.toInt())
        ).map { colors ->
            GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { cornerRadius = rankRadius }
        }
    }

    init { setHasStableIds(true) }
    override fun getItemId(position: Int) = rows[position].id.toLongOrNull() ?: rows[position].id.hashCode().toLong()
    override fun getItemCount() = rows.size
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val context = parent.context
        val cardMargin = TvUi.dimen(context, R.dimen.series_card_margin)
        val card = TvUi.column(context).apply {
            isFocusable = true; isClickable = true
            background = TvUi.focusBackground(radius = 12f)
            setPadding(cardMargin, cardMargin, cardMargin, cardMargin)
            layoutParams = RecyclerView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(cardMargin, cardMargin, cardMargin, cardMargin)
            }
        }

        // Image with rounded corners & rank badge container
        val imageContainer = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                setColor(0xff1e293b.toInt())
                cornerRadius = cardMargin.toFloat()
            }
        }
        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        imageContainer.addView(image, FrameLayout.LayoutParams(-1, -1))

        // Rank Badge (for Top rankings)
        val rankBadge = TextView(context).apply {
            textSize = 11f; setTextColor(Color.WHITE); setTypeface(typeface, Typeface.BOLD)
            val rankPadH = TvUi.dimen(context, R.dimen.seek_hud_delta_pad_h)
            val rankPadV = TvUi.dimen(context, R.dimen.seek_hud_delta_pad_v)
            setPadding(rankPadH, rankPadV, rankPadH, rankPadV)
            visibility = android.view.View.GONE
        }
        imageContainer.addView(rankBadge, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.START))

        card.addView(imageContainer, LinearLayout.LayoutParams(-1, TvUi.dimen(context, R.dimen.series_card_image_height)))

        val title = TextView(context).apply {
            textSize = 14f; setTextColor(Color.WHITE); maxLines = 2; minLines = 2
            val padH = TvUi.dimen(context, R.dimen.series_card_title_pad_h)
            val padTop = TvUi.dimen(context, R.dimen.series_card_title_pad_top)
            val padBottom = TvUi.dimen(context, R.dimen.series_card_title_pad_bottom)
            setPadding(padH, padTop, padH, padBottom)
            setTypeface(typeface, Typeface.BOLD)
        }
        val badge = TextView(context).apply {
            textSize = 12f; setTextColor(TvUi.AMBER)
            val padH = TvUi.dimen(context, R.dimen.series_card_badge_pad_h)
            val padBottom = TvUi.dimen(context, R.dimen.series_card_badge_pad_bottom)
            setPadding(padH, 0, padH, padBottom)
        }
        card.addView(title)
        card.addView(badge)
        val progress = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 1000
            progressTintList = ColorStateList.valueOf(TvUi.RED)
            progressBackgroundTintList = ColorStateList.valueOf(0x44ffffff.toInt())
            visibility = android.view.View.GONE
        }
        val progressLayoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            TvUi.dimen(context, R.dimen.series_card_progress_height)
        ).apply {
            topMargin = TvUi.dimen(context, R.dimen.series_card_progress_margin_top)
        }
        card.addView(progress, progressLayoutParams)

        return Holder(card, imageContainer, image, rankBadge, title, badge,progress)
    }

    fun appendRows(newRows: List<Series>) {
        if (newRows.isEmpty()) return
        val oldSize = rows.size
        rows.addAll(newRows)
        notifyItemRangeInserted(oldSize, newRows.size)
    }

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val series = rows[position]
        holder.title.text = series.title
        val sub = subtitle(series)
        if (sub.isNotBlank()) {
            holder.badge.visibility = android.view.View.VISIBLE
            holder.badge.text = sub
        } else {
            holder.badge.visibility = android.view.View.GONE
        }
        holder.card.contentDescription = if (sub.isNotBlank()) "${series.title}，${sub}" else series.title
        val value=progress(series);holder.progress.visibility=if(value==null)android.view.View.GONE else android.view.View.VISIBLE
        holder.progress.progress=((value?:0f).coerceIn(0f,1f)*1000).toInt()

        // Ranking badges (all positions on rank page, or when badge contains 榜)
        if (isRank || series.badge.contains("榜")) {
            holder.rankBadge.visibility = android.view.View.VISIBLE
            holder.rankBadge.text = "Top ${position + 1}"
            holder.rankBadge.background = holder.rankBackgrounds[position.coerceAtMost(3)]
        } else {
            holder.rankBadge.visibility = android.view.View.GONE
        }

        holder.card.setOnClickListener { selected(series) }
        holder.card.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                focused(series)
                holder.card.scaleX = 1.04f
                holder.card.scaleY = 1.04f
            } else {
                holder.card.scaleX = 1f
                holder.card.scaleY = 1f
            }
        }
        artwork.load(series.cover, holder.image)
    }

    override fun onViewRecycled(holder: Holder) {
        artwork.clear(holder.image)
        holder.card.setOnClickListener(null)
        holder.card.onFocusChangeListener = null
        holder.card.scaleX = 1f
        holder.card.scaleY = 1f
        holder.card.contentDescription = null
        holder.title.text = ""
        holder.badge.text = ""
        holder.badge.visibility = android.view.View.GONE
        holder.rankBadge.text = ""
        holder.rankBadge.visibility = android.view.View.GONE
        holder.progress.progress = 0
        holder.progress.visibility = android.view.View.GONE
        super.onViewRecycled(holder)
    }
}
